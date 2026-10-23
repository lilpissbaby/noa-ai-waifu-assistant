// Herramientas de memoria a largo plazo (ver productivity/memory.js).
import { listMemory, saveMemory, forgetMemory } from '../productivity/memory.js';

export function memoryTools() {
  const group = 'remember facts about the user';
  return [
    {
      name: 'memory_save',
      group,
      description:
        'Saves a lasting fact about the user (preferences, names of people and pets, projects, how they like things done) so you remember it in future conversations. Use it when they ask you to remember something or share a durable preference. Never save passwords, keys or card numbers.',
      schema: { type: 'object', properties: { fact: { type: 'string', description: 'One short fact, in third person.' } }, required: ['fact'] },
      run: async ({ fact }) => `Saved: ${saveMemory(fact).text}`,
    },
    {
      name: 'memory_list',
      group,
      description: 'Lists everything you remember about the user, with ids.',
      schema: { type: 'object', properties: {} },
      run: async () => listMemory().map(({ id, text }) => ({ id, text })),
    },
    {
      name: 'memory_forget',
      group,
      description: 'Forgets a saved fact by id (when the user asks you to forget it or it is no longer true).',
      schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
      run: async ({ id }) => {
        const m = listMemory().find((x) => x.id === id);
        if (!m || !forgetMemory(id)) throw new Error(`No memory with id ${id}. Use memory_list.`);
        return `Forgot: ${m.text}`;
      },
    },
  ];
}
