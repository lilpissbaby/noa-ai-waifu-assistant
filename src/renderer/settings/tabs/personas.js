// Ajustes → Personajes: lista, plantillas, editor de cada personaje y filtros de contenido.
// Recibe los ayudantes de settings.js para no duplicar el mini-DOM ni el guardado.
import { FILTER_LEVELS, TEMPLATE_IDS, personaFromTemplate, normalizePersona } from '../../../shared/personas.js';

let editingId = null;
let saveTimer = null;

export function personasTab(ui) {
  const { h, card, field, t, wd, getLocale, toast } = ui;
  const pc = ui.getPc();
  const c = pc.config;
  const personas = c.personas.map((p) => ({ ...p, filters: { ...p.filters } }));
  if (!personas.some((p) => p.id === editingId)) editingId = c.activePersonaId;
  const editing = personas.find((p) => p.id === editingId) || personas[0];

  // Guarda la lista entera (los arrays se sustituyen al parchear la configuración).
  const persist = (delay = 400) => {
    clearTimeout(saveTimer);
    ui.markEdit();
    saveTimer = setTimeout(async () => {
      ui.setPc(await wd.invoke('cfg:patch', { personas }));
      ui.markEdit();
      toast(t('settings.saved'));
    }, delay);
  };
  const persistNow = async () => {
    clearTimeout(saveTimer);
    ui.setPc(await wd.invoke('cfg:patch', { personas }));
    ui.render();
  };

  // ------------------------------------------------ lista
  const list = h('div', { class: 'persona-list' });
  for (const p of personas) {
    const active = p.id === c.activePersonaId;
    list.append(
      h(
        'div',
        { class: `persona-row${p.id === editing.id ? ' editing' : ''}` },
        p.avatar ? h('img', { class: 'persona-avatar', src: p.avatar, alt: '' }) : h('span', { class: 'persona-avatar empty' }, p.name.slice(0, 1)),
        h('strong', {}, p.name),
        h(
          'div',
          { class: 'row' },
          active
            ? h('span', { class: 'pill active' }, t('settings.common.inUse'))
            : h(
                'button',
                {
                  class: 'btn primary',
                  onclick: async () => {
                    await wd.invoke('persona:switch', p.id);
                    ui.setPc(await wd.invoke('cfg:get'));
                    ui.render();
                  },
                },
                t('settings.personas.use'),
              ),
          h(
            'button',
            {
              class: 'btn',
              onclick: () => {
                editingId = p.id;
                ui.render();
              },
            },
            t('settings.personas.edit'),
          ),
          h(
            'button',
            {
              class: 'btn',
              onclick: () => {
                const copy = normalizePersona({ ...p, id: '', name: t('settings.personas.copyName', { name: p.name }) });
                personas.push(copy);
                editingId = copy.id;
                persistNow();
              },
            },
            t('settings.personas.duplicate'),
          ),
          personas.length > 1 && !active
            ? h('button', {
                class: 'btn ghost danger',
                html: ui.icons.trash,
                title: t('settings.common.delete'),
                onclick: () => {
                  if (!confirm(t('settings.personas.deleteConfirm', { name: p.name }))) return;
                  personas.splice(personas.indexOf(p), 1);
                  persistNow();
                },
              })
            : null,
        ),
      ),
    );
  }
  const templateSel = h('select', {}, TEMPLATE_IDS.map((id) => h('option', { value: id }, `${t(`settings.personas.templates.${id}`)} · ${personaFromTemplate(id, getLocale()).name}`)));
  const addRow = h(
    'div',
    { class: 'template-row' },
    h('span', { class: 'muted' }, t('settings.personas.fromTemplate')),
    templateSel,
    h(
      'button',
      {
        class: 'btn',
        onclick: () => {
          const p = personaFromTemplate(templateSel.value, getLocale());
          personas.push(p);
          editingId = p.id;
          persistNow();
        },
      },
      t('settings.personas.create'),
    ),
  );

  // ------------------------------------------------ editor
  const bind = (prop, multiline = 0, placeholder = '') => {
    const attrs = {
      value: editing[prop] ?? '',
      placeholder,
      oninput: (e) => {
        editing[prop] = e.target.value;
        persist();
      },
    };
    return multiline ? h('textarea', { rows: multiline, ...attrs }) : h('input', { type: 'text', ...attrs });
  };

  const skinSel = h('select', {
    onchange: (e) => {
      editing.skinId = e.target.value || null;
      persist(0);
    },
  });
  skinSel.append(h('option', { value: '' }, t('settings.personas.skinKeep')));
  wd.invoke('skin:list').then((skins) => {
    for (const s of skins) skinSel.append(h('option', { value: s.id, selected: s.id === editing.skinId }, s.name));
  });

  const voiceBox = h('div', { class: 'grid' });
  const renderVoice = () => {
    voiceBox.innerHTML = '';
    const v = editing.voice || {};
    const modeSel = h(
      'select',
      {
        onchange: (e) => {
          editing.voice = e.target.value ? { mode: e.target.value } : null;
          persist(0);
          renderVoice();
        },
      },
      [
        ['', t('settings.personas.voiceInherit')],
        ['system', t('settings.personas.voiceSystem')],
        ['openai', t('settings.personas.voiceOpenai')],
        ['elevenlabs', t('settings.personas.voiceEleven')],
        ...(ui.extraVoiceModes || []),
      ].map(([val, label]) => h('option', { value: val, selected: (v.mode || '') === val }, label)),
    );
    voiceBox.append(field(t('settings.personas.voice'), modeSel));
    if (v.mode === 'system') {
      const sel = h('select', {
        onchange: (e) => {
          editing.voice = { ...editing.voice, systemVoice: e.target.value };
          persist(0);
        },
      });
      const fill = () => {
        sel.innerHTML = '';
        sel.append(h('option', { value: '' }, t('settings.personas.voiceAuto')));
        for (const x of speechSynthesis.getVoices()) sel.append(h('option', { value: x.name, selected: x.name === v.systemVoice }, `${x.name} (${x.lang})`));
      };
      fill();
      speechSynthesis.addEventListener('voiceschanged', fill, { once: true });
      voiceBox.append(field(t('settings.personas.voiceName'), sel));
    } else if (v.mode === 'openai' || v.mode === 'elevenlabs') {
      const key = v.mode === 'openai' ? 'voice' : 'elevenVoiceId';
      voiceBox.append(
        field(
          t('settings.personas.voiceName'),
          h('input', {
            type: 'text',
            value: v[key] || '',
            oninput: (e) => {
              editing.voice = { ...editing.voice, [key]: e.target.value };
              persist();
            },
          }),
        ),
      );
    } else if (ui.renderExtraVoice) ui.renderExtraVoice(voiceBox, editing, persist);
  };
  renderVoice();

  // ------------------------------------------------ filtros
  const unlocked = !!c.content?.adultUnlockedAt;
  const filterGrid = h('div', { class: 'grid' });
  for (const [key, levels] of Object.entries(FILTER_LEVELS)) {
    filterGrid.append(
      field(
        t(`settings.personas.filter.${key}`),
        h(
          'select',
          {
            'data-filter': key,
            onchange: (e) => {
              editing.filters[key] = e.target.value;
              persist(0);
              if (key === 'sexual') ui.render();
            },
          },
          levels.map((lv) => h('option', { value: lv, selected: editing.filters[key] === lv }, t(`settings.personas.level.${lv}`))),
        ),
      ),
    );
  }
  const adultBox = h(
    'div',
    { class: 'adult-box' },
    h('strong', {}, t('settings.personas.adultTitle')),
    unlocked
      ? h('p', { class: 'small' }, t('settings.personas.adultUnlocked', { date: new Date(c.content.adultUnlockedAt).toLocaleDateString() }))
      : h('p', { class: 'small' }, t('settings.personas.adultLocked')),
    !unlocked && editing.filters.sexual !== 'off' ? h('p', { class: 'small warn' }, t('settings.personas.adultPending')) : null,
    h(
      'div',
      { class: 'row' },
      h(
        'button',
        {
          class: 'btn',
          id: unlocked ? 'adultLock' : 'adultUnlock',
          onclick: async () => {
            await wd.invoke(unlocked ? 'persona:lock-adult' : 'persona:unlock-adult');
            ui.setPc(await wd.invoke('cfg:get'));
            ui.render();
          },
        },
        unlocked ? t('settings.personas.adultLock') : t('settings.personas.adultUnlock'),
      ),
    ),
    h('p', { class: 'small muted' }, t('settings.personas.providerNote')),
    h('p', { class: 'small muted' }, t('settings.personas.hardLimits')),
  );

  return [
    h('h1', {}, t('settings.nav.personas')),
    h('p', { class: 'lead' }, t('settings.personas.lead')),
    card(t('settings.personas.listTitle'), null, list, addRow, ...(ui.listExtras ? ui.listExtras(personas, persistNow) : [])),
    card(
      t('settings.personas.editorTitle', { name: editing.name }),
      null,
      h(
        'div',
        { class: 'grid' },
        field(t('settings.personas.name'), bind('name')),
        field(t('settings.personas.skin'), skinSel),
        h('div', { class: 'full' }, voiceBox),
        h('div', { class: 'full' }, field(t('settings.personas.personality'), bind('personality', 4), t('settings.personas.personalityHelp'))),
        h('div', { class: 'full' }, field(t('settings.personas.scenario'), bind('scenario', 2), t('settings.personas.scenarioHelp'))),
        h('div', { class: 'full' }, field(t('settings.personas.greeting'), bind('greeting', 2), t('settings.personas.greetingHelp'))),
        h('div', { class: 'full' }, field(t('settings.personas.examples'), bind('examples', 4), t('settings.personas.examplesHelp'))),
        h('div', { class: 'full' }, field(t('settings.personas.extra'), bind('extraInstructions', 3), t('settings.personas.extraHelp'))),
      ),
    ),
    card(t('settings.personas.filtersTitle'), t('settings.personas.filtersDesc'), filterGrid, adultBox),
  ];
}
