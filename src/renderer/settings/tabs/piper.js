// Ajustes → Voz → «Voces locales (Piper)»: el motor, las voces instaladas, el catálogo oficial
// e importar packs. También el selector de voz Piper del editor de personajes.
import { languageFromName } from '../../../shared/i18n/index.js';

let catalogLang = null;
const clean = (e) => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');

export function piperSection(ui) {
  const { h, field, t, wd, icons, toast } = ui;
  const tp = (key, vars) => t(`settings.voice.piper.${key}`, vars);
  const quality = (q) => (q ? tp(`quality.${q}`) : '');
  const box = h('div', { class: 'piper' });
  const tts = () => ui.getPc().config.voice.tts;

  const use = async (key) => {
    ui.markEdit();
    ui.setPc(await wd.invoke('cfg:patch', { voice: { tts: { piperVoice: key, piperSpeaker: 0 } } }));
  };

  const importVoices = async () => {
    const r = await wd.invoke('voice:piper-import');
    if (!r) return;
    if (r.error) return toast(r.error);
    toast(tp('imported', { names: r.voices.map((v) => v.name).join(', ') }));
    ui.setPc(await wd.invoke('cfg:get'));
    paint();
  };

  const catalogRow = (e, installedKeys) => {
    const btn = h('button', { class: 'btn', 'data-install': e.key }, installedKeys.has(e.key) ? t('settings.common.inUse') : tp('install'));
    if (installedKeys.has(e.key)) btn.disabled = true;
    btn.onclick = async () => {
      btn.disabled = true;
      const off = wd.on('voice:piper-install-progress', ({ key, p }) => key === e.key && (btn.textContent = tp('installing', { percent: Math.round(p * 100) })));
      const r = await wd.invoke('voice:piper-install', e.key).finally(off);
      if (r.error) {
        toast(r.error);
        btn.disabled = false;
        btn.textContent = tp('install');
        return;
      }
      toast(r.voice.license ? `${r.voice.name} · ${tp('license', { license: r.voice.license })}` : r.voice.name);
      ui.setPc(await wd.invoke('cfg:get'));
      paint();
    };
    return h(
      'div',
      { class: 'voice-row' },
      h(
        'div',
        {},
        h('strong', {}, e.name),
        h('span', { class: 'muted small' }, ` · ${e.languageName} · ${quality(e.quality)}${e.speakers > 1 ? ` · ${tp('speakers', { count: e.speakers })}` : ''} · ${tp('size', { mb: e.sizeMB })}`),
      ),
      btn,
    );
  };

  const catalogBox = (installed) => {
    const installedKeys = new Set(installed.map((v) => v.key));
    const langSel = h('select', {
      id: 'piperLang',
      onchange: (e) => {
        catalogLang = e.target.value;
        load(false);
      },
    });
    const list = h('div', { class: 'voice-list' });
    catalogLang ??= languageFromName(ui.getPc().config.assistant.language) || ui.getLocale();
    langSel.append(h('option', { value: catalogLang }, catalogLang || tp('allLanguages')));
    const load = async (force) => {
      list.innerHTML = '';
      list.append(h('p', { class: 'small muted' }, tp('loading')));
      const r = await wd.invoke('voice:piper-catalog', { force, language: catalogLang });
      list.innerHTML = '';
      if (r.error) return list.append(h('p', { class: 'small err-text' }, tp('catalogError', { message: r.error })));
      langSel.innerHTML = '';
      langSel.append(h('option', { value: '' }, tp('allLanguages')));
      for (const [code, name] of r.languages) langSel.append(h('option', { value: code, selected: code === catalogLang }, `${name} (${code})`));
      if (!r.entries.length) list.append(h('p', { class: 'small muted' }, tp('empty')));
      for (const e of r.entries) list.append(catalogRow(e, installedKeys));
    };
    load(false);
    return h(
      'div',
      { class: 'piper-catalog' },
      h('h3', {}, tp('catalogTitle')),
      h('p', { class: 'small muted' }, tp('catalogText')),
      h('div', { class: 'template-row' }, h('span', { class: 'muted' }, tp('language')), langSel, h('button', { class: 'btn ghost', onclick: () => load(true) }, tp('refresh'))),
      list,
    );
  };

  async function paint() {
    const { runtime, voices } = await wd.invoke('voice:piper-list');
    box.innerHTML = '';
    if (!runtime.ready) {
      const status = h('span', { class: 'small muted' });
      const btn = h('button', { class: 'btn primary', id: 'piperRuntime' }, tp('download'));
      btn.onclick = async () => {
        btn.disabled = true;
        const off = wd.on('voice:piper-runtime-progress', (p) => (status.textContent = tp('downloading', { percent: Math.round(p * 100) })));
        try {
          await wd.invoke('voice:piper-runtime-download');
          toast(tp('ready'));
          paint();
        } catch (e) {
          status.textContent = clean(e);
          btn.disabled = false;
        } finally {
          off();
        }
      };
      box.append(h('div', { class: 'piper-runtime' }, h('strong', {}, tp('runtimeTitle')), h('p', { class: 'small' }, tp('runtimeText', { mb: runtime.sizeMB })), h('div', { class: 'row' }, btn, status)));
    }

    box.append(h('h3', {}, tp('installedTitle')));
    if (!voices.length) box.append(h('p', { class: 'small muted' }, tp('none')));
    const list = h('div', { class: 'voice-list' });
    for (const v of voices) {
      const inUse = v.key === tts().piperVoice;
      list.append(
        h(
          'div',
          { class: `voice-row${inUse ? ' active' : ''}`, 'data-voice': v.key },
          h(
            'div',
            {},
            h('strong', {}, v.name),
            h('span', { class: 'muted small' }, ` · ${v.language} · ${quality(v.quality)}${v.speakers > 1 ? ` · ${tp('speakers', { count: v.speakers })}` : ''}`),
            h('div', { class: 'small muted' }, v.license ? tp('license', { license: v.license }) : tp('noLicense')),
          ),
          h(
            'div',
            { class: 'row' },
            inUse
              ? h('span', { class: 'pill active' }, t('settings.common.inUse'))
              : h(
                  'button',
                  {
                    class: 'btn',
                    onclick: async () => {
                      await use(v.key);
                      paint();
                    },
                  },
                  tp('use'),
                ),
            h('button', {
              class: 'btn ghost',
              html: icons.play,
              title: t('settings.voice.test'),
              onclick: async () => {
                if (!inUse) await use(v.key);
                await wd.invoke('voice:test-tts', ui.samplePhrase());
                if (!inUse) paint();
              },
            }),
            h('button', {
              class: 'btn ghost danger',
              html: icons.trash,
              title: t('settings.common.delete'),
              onclick: async () => {
                if (!confirm(tp('deleteConfirm', { name: v.name }))) return;
                await wd.invoke('voice:piper-delete', v.key);
                paint();
              },
            }),
          ),
        ),
      );
    }
    box.append(list);

    const cur = voices.find((v) => v.key === tts().piperVoice);
    const grid = h('div', { class: 'grid', style: 'margin-top:12px' });
    if (cur && cur.speakers > 1)
      grid.append(
        field(
          tp('speaker'),
          h(
            'select',
            { onchange: (e) => ui.save('voice.tts.piperSpeaker', Number(e.target.value), 0) },
            Array.from({ length: cur.speakers }, (_, i) => h('option', { value: i, selected: i === Number(tts().piperSpeaker) }, cur.speakerNames?.[i] || `#${i + 1}`)),
          ),
        ),
      );
    grid.append(field(t('settings.voice.rate'), ui.text('voice.tts.piperRate', { type: 'number' })));
    box.append(grid);

    box.append(
      h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'btn', id: 'piperImport', onclick: importVoices }, tp('import')), h('span', { class: 'small muted' }, tp('importText'))),
    );
    box.append(catalogBox(voices));
  }
  paint();
  return box;
}

// Selector de voz Piper para el editor de personajes (Ajustes → Personajes).
export function piperPersonaVoice(ui, box, editing, persist) {
  const { h, field, t, wd } = ui;
  wd.invoke('voice:piper-list').then(({ voices }) => {
    if (!voices.length) return box.append(h('p', { class: 'small muted' }, t('settings.personas.piperNone')));
    const v = editing.voice;
    const sel = h(
      'select',
      {
        onchange: (e) => {
          editing.voice = { ...editing.voice, piperVoice: e.target.value, piperSpeaker: 0 };
          persist(0);
        },
      },
      h('option', { value: '' }, t('settings.personas.voiceAuto')),
      voices.map((x) => h('option', { value: x.key, selected: x.key === v.piperVoice }, `${x.name} (${x.language})`)),
    );
    box.append(field(t('settings.personas.voiceName'), sel));
  });
}
