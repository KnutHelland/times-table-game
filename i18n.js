// The texts of each language are in lang/<code>.js, which adds STRINGS.<code>. Norwegian bokmål has the code
// 'no' (from before nynorsk was added), so languages saved by earlier versions stay valid.
const STRINGS = {};
const LANGUAGES = ['en', 'no', 'nn', 'sv', 'da', 'de', 'fr', 'es'];

// the first of the browser's languages that the game has; 'nb' is bokmål
function browserLanguage() {
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const code = tag?.toLowerCase().split('-')[0];
    const lang = code === 'nb' ? 'no' : code;
    if (LANGUAGES.includes(lang)) return lang;
  }
  return 'en';
}
