export function t(messageName: string, substitutions?: string | string[]): string {
  return chrome.i18n.getMessage(messageName, substitutions) || messageName;
}

export function localizeDocument(): void {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  document.title = t("extension_name");
}
