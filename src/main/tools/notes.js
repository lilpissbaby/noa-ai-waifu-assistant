// Herramientas de notas en Markdown (ver productivity/notes.js).
import path from 'node:path';
import { userDir } from '../config.js';
import { noteCreate, noteAppend, noteRead, noteSearch } from '../productivity/notes.js';

export const notesDir = (cfg) => cfg.productivity?.notesDir?.trim() || path.join(userDir(), 'notes');

export function noteTools(cfg) {
  const dir = () => notesDir(cfg);
  const group = 'take and look up notes';
  const title = { type: 'string', description: 'Note title (also its file name).' };
  return [
    {
      name: 'note_create',
      group,
      description: "Creates a new Markdown note in the user's notes folder. If the title exists, a numbered copy is made (use note_append to add to an existing note).",
      schema: { type: 'object', properties: { title, content: { type: 'string', description: 'Markdown content.' } }, required: ['title', 'content'] },
      run: async (input) => `Created note "${noteCreate(dir(), input).title}".`,
    },
    {
      name: 'note_append',
      group,
      description: 'Adds text to the end of a note (creates it if it does not exist). Good for lists, journals and meeting notes.',
      schema: { type: 'object', properties: { title, content: { type: 'string' } }, required: ['title', 'content'] },
      run: async (input) => `Added to "${noteAppend(dir(), input).title}".`,
    },
    {
      name: 'note_read',
      group,
      description: 'Reads a note by title.',
      schema: { type: 'object', properties: { title }, required: ['title'] },
      run: async (input) => noteRead(dir(), input),
    },
    {
      name: 'note_search',
      group,
      description: 'Searches the notes by title and content (subfolders included). Returns up to 20 titles with a snippet.',
      schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
      run: async ({ query }) => noteSearch(dir(), query),
    },
  ];
}
