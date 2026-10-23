// Save codes: one player's name, picture, settings, medals and high scores as a single string that can be copied
// to another device or kept as a backup. Format: SAVE_PREFIX + base64url(UTF-8 JSON). Base64 survives chat apps and
// e-mail, which change quotes and wrap lines in plain JSON. The JSON names its format and version, so a later
// version of the game can still read old codes: when SAVE_VERSION goes up, add a migration step in readSaveCode.
const SAVE_PREFIX = 'ttg1.';
const SAVE_FORMAT = 'times-table-game/player';
const SAVE_VERSION = 1;

function toBase64Url(text) {
  let binary = '';
  for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(code) {
  const binary = atob(code.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}

function makeSaveCode(profile, { settings, progress, scores }) {
  const save = {
    format: SAVE_FORMAT,
    version: SAVE_VERSION,
    exported: new Date().toISOString(),
    player: { name: profile.name, avatar: profile.avatar },
    settings, progress, scores,
  };
  return SAVE_PREFIX + toBase64Url(JSON.stringify(save));
}

// --- reading: everything is checked, unknown fields are ignored, so a damaged or odd code cannot break the game ---

const isObject = value => typeof value === 'object' && value !== null && !Array.isArray(value);
const isCount = value => Number.isInteger(value) && value >= 0;
const isTable = value => Number.isInteger(value) && value >= 1 && value <= 12;

function cleanSettings(raw) {
  const clean = {};
  if (!isObject(raw)) return clean;
  if (LANGUAGES.includes(raw.lang)) clean.lang = raw.lang;
  if (Array.isArray(raw.tables)) clean.tables = [...new Set(raw.tables.filter(isTable))];
  if (typeof raw.include1112 === 'boolean') clean.include1112 = raw.include1112;
  if (raw.tab === 'levels' || raw.tab === 'free') clean.tab = raw.tab;
  return clean;
}

function cleanProgress(raw) {
  const clean = {};
  if (!isObject(raw)) return clean;
  for (const [id, entry] of Object.entries(raw)) {
    if (/^(12:)?[A-Za-z]+-\d+$/.test(id) && [1, 2, 3].includes(entry?.medal)) clean[id] = { medal: entry.medal };
  }
  return clean;
}

function cleanScores(raw) {
  const clean = {};
  if (!isObject(raw)) return clean;
  for (const modeId of Object.keys(FREE_MODES)) {
    if (!Array.isArray(raw[modeId])) continue;
    clean[modeId] = raw[modeId]
      .filter(score => isObject(score) && typeof score.time === 'number' && score.time >= 0 && Array.isArray(score.tables))
      .map(score => ({
        time: score.time,
        correct: isCount(score.correct) ? score.correct : 0,
        wrong: isCount(score.wrong) ? score.wrong : 0,
        score: isCount(score.score) ? score.score : 0,
        tables: score.tables.filter(isTable),
        date: typeof score.date === 'string' ? score.date : '',
      }))
      .slice(0, MAX_SCORES);
  }
  return clean;
}

// returns { save } or { error: 'invalid' | 'tooNew' }
function readSaveCode(text) {
  const code = text.replace(/\s+/g, '');
  const isJson = code.startsWith('{'); // the decoded form is accepted too
  if (!isJson && !code.startsWith(SAVE_PREFIX)) return { error: 'invalid' };
  let save;
  try {
    save = JSON.parse(isJson ? code : fromBase64Url(code.slice(SAVE_PREFIX.length)));
  } catch {
    return { error: 'invalid' };
  }
  if (!isObject(save) || save.format !== SAVE_FORMAT || !Number.isInteger(save.version)) return { error: 'invalid' };
  if (save.version > SAVE_VERSION) return { error: 'tooNew' };
  const name = typeof save.player?.name === 'string' ? save.player.name.trim().slice(0, MAX_NAME_LENGTH).trim() : '';
  if (!name) return { error: 'invalid' };
  return {
    save: {
      name,
      avatar: AVATARS.includes(save.player.avatar) ? save.player.avatar : null,
      settings: cleanSettings(save.settings),
      progress: cleanProgress(save.progress),
      scores: cleanScores(save.scores),
    },
  };
}

const medalCount = progress => Object.values(progress).filter(entry => entry.medal > 0).length;
