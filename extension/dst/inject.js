"use strict";
class Globals {
    static debugMode = !chrome.runtime.getManifest().update_url;
    static discordChannelUrl = "https://discord.com/channels/357247482247380994/358044869685673985";
    static SETTING_CODES = "redeemedCodes";
    static SETTING_PENDING = "pendingCodes";
    static SETTING_INSTANCE_ID = "instanceId";
    static SETTING_USER_HASH = "userHash";
    static SETTING_USER_ID = "userId";
}
const _servicePort = chrome.runtime.connect({ name: "page" });
_servicePort.onMessage.addListener(onMessage);
_servicePort.postMessage({ messageType: "pageReady" });
const _observer = new MutationObserver((mutationList, observer) => {
    if (mutationList.some((mut) => mut.addedNodes.length > 0)) {
        const codes = getCodesList();
        if (codes.length > 0) {
            console.info("Observer found codes, sending to service worker");
            observer.disconnect();
            _servicePort.postMessage({ messageType: "codes", codes: codes });
        }
    }
});
function onMessage(message, port) {
    switch (message.messageType) {
        case "scanCodes":
            console.info("Scan codes message received.");
            const codes = getCodesList();
            if (codes.length > 0) {
                console.info("Found codes, sending to service worker");
                port.postMessage({ messageType: "codes", codes: codes });
            }
            else {
                console.info("Codes not found yet, observing DOM for new codes.");
                const observerConfig = { childList: true, subtree: true };
                _observer.observe(window.document, observerConfig);
            }
            break;
        case "closeTab":
            window.close();
            break;
    }
}
function getCodesList() {
    const regex = /(?:[A-Z0-9*!@#$%^&*]-?){12}(?:(?:[A-Z0-9*!@#$%^&*]-?){4})?/g;
    const codes = [];
    const messageElements = document.querySelectorAll("div[class^='message']");
    messageElements.forEach(messageElement => {
        const markupElement = messageElement.querySelector("div[class^='markup']");
        if (markupElement) {
            const codeMatch = markupElement.innerText.toUpperCase().match(regex);
            if (codeMatch?.[0]) {
                const code = codeMatch[0].replaceAll("-", "");
                console.debug(`Idle Code found: ${code}`);
                codes.push(code);
            }
        }
    });
    return codes;
}
