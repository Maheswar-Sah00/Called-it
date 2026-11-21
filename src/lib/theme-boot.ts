export const THEME_KEY = "ci-theme";

/** Runs before paint (inlined in <head>) so there is no flash of the wrong theme. */
export const themeBootScript = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'auto';var h=new Date().getHours();var t=p==='auto'?(h>=6&&h<18?'day':'night'):p;document.documentElement.dataset.theme=t;document.documentElement.dataset.themePref=p;}catch(e){document.documentElement.dataset.theme='night';}})();`;
