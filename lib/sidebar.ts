export const SIDEBAR_MIN_WIDTH = 200;
export const SIDEBAR_MAX_WIDTH = 400;
export const SIDEBAR_DEFAULT_WIDTH = 254;
export const SIDEBAR_WIDTH_VAR = "--sidebar-width";
export const SIDEBAR_WIDTH_STORAGE_KEY = "sidebar-width";

export function clampSidebarWidth(width: number) {
  return Math.round(
    Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width)),
  );
}

export const SIDEBAR_WIDTH_SCRIPT = `try{var w=parseInt(localStorage.getItem("${SIDEBAR_WIDTH_STORAGE_KEY}"),10);if(w>=${SIDEBAR_MIN_WIDTH}&&w<=${SIDEBAR_MAX_WIDTH})document.documentElement.style.setProperty("${SIDEBAR_WIDTH_VAR}",w+"px")}catch(e){}`;
