// Light/dark theme shared by the layout (server) and ThemeToggle (client).

export const THEME_STORAGE_KEY = "of.theme";

// Runs in <head> before the page paints, so a saved dark theme never flashes
// light first. Without a saved choice the OS setting decides.
export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";if(t==="dark")document.documentElement.classList.add("dark")}catch(e){}`;
