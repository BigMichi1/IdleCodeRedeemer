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
document.addEventListener("DOMContentLoaded", () => {
    loaded();
});
const _servicePort = chrome.runtime.connect({ name: "options" });
_servicePort.onMessage.addListener(onMessage);
_servicePort.postMessage({ messageType: "pageReady" });
function onMessage(message, port) {
    switch (message.messageType) {
        case "error":
        case "info":
        case "success":
        case "missingCredentials":
            handleMessage(message);
            break;
        case "activateTab":
            chrome.tabs.getCurrent((tab) => {
                if (tab?.id) {
                    chrome.tabs.update(tab.id, { "active": true });
                }
            });
            break;
    }
}
function loaded() {
    chrome.storage.sync.get([Globals.SETTING_USER_ID, Globals.SETTING_USER_HASH], ({ userId, userHash }) => {
        const userIdElement = document.getElementById("userId");
        userIdElement.value = userId ?? "";
        userIdElement.addEventListener("blur", settingsUpdated);
        const userHashElement = document.getElementById("userHash");
        userHashElement.value = userHash ?? "";
        userHashElement.addEventListener("blur", settingsUpdated);
    });
    const userHashElement = document.getElementById("supportUrl");
    userHashElement.addEventListener("blur", parseSupportUrl);
}
function settingsUpdated(ev) {
    saveUpdatedSettings();
}
function saveUpdatedSettings() {
    chrome.storage.sync.set({
        [Globals.SETTING_USER_ID]: document.getElementById("userId").value,
        [Globals.SETTING_USER_HASH]: document.getElementById("userHash").value
    }, () => console.log("User settings saved"));
    document.getElementById("settingsInfo").classList.add("show");
    document.querySelector("#settingsInfo span").innerHTML = "After updating credentials, click browser extension button to launch new request.";
}
function parseSupportUrl(ev) {
    const userIdElement = document.getElementById("userId");
    const userHashElement = document.getElementById("userHash");
    const supportUrlElement = document.getElementById("supportUrl");
    if (supportUrlElement.value == "") {
        return;
    }
    try {
        const url = new URL(supportUrlElement.value);
        var userId = url.searchParams.get("user_id");
        var hash = url.searchParams.get("device_hash");
        if (!userId || !hash) {
            document.getElementById("settingsInfo").classList.add("show");
            document.querySelector("#settingsInfo span").innerHTML = "Couldn't find user_id or device_hash parameters in URL.";
            return;
        }
        userIdElement.value = userId;
        userHashElement.value = hash;
        supportUrlElement.value = "";
        saveUpdatedSettings();
    }
    catch {
        document.getElementById("settingsInfo").classList.add("show");
        document.querySelector("#settingsInfo span").innerHTML = "Failed to parse URL. Make sure you are copying from the URL bar of the browser.";
    }
}
function hideMessages() {
    document.getElementById("error").classList.remove("show");
    document.getElementById("success").classList.remove("show");
    document.getElementById("info").classList.remove("show");
    document.getElementById("errorSettings").classList.remove("show");
    document.querySelector("#chests tbody").innerHTML = "";
}
function handleMessage(message) {
    hideMessages();
    switch (message.messageType) {
        case "error":
            document.getElementById("error").classList.add("show");
            document.querySelector("#error span").innerHTML = message.messageText ?? "";
            break;
        case "info":
            document.getElementById("info").classList.add("show");
            document.querySelector("#info span").innerHTML = message.messageText ?? "";
            break;
        case "missingCredentials":
            document.getElementById("errorSettings").classList.add("show");
            document.querySelector("#errorSettings span").innerHTML = "Missing credentials.";
            document.getElementById("settingsTabButton").click();
            break;
        case "success":
            document.getElementById("success").classList.add("show");
            document.querySelector("#success span").innerHTML = message.messageText ?? "";
            const chestsTableBody = document.querySelector("#chests tbody");
            chestsTableBody.innerHTML = "";
            let unknownCount = 0;
            if (message.heroUnlocks) {
                chestsTableBody.appendChild(buildTableRow("Hero Unlocks", message.heroUnlocks));
            }
            if (message.skinUnlocks) {
                chestsTableBody.appendChild(buildTableRow("Skin Unlocks", message.skinUnlocks));
            }
            Object.entries(message.chests || []).forEach(([chestType, amount]) => {
                let label = "";
                switch (chestType) {
                    case 282..toString():
                        label = "Electrum Chests";
                        break;
                    case 2..toString():
                        label = "Gold Chests";
                        break;
                    case 230..toString():
                        label = "Modron Chests";
                        break;
                    default:
                        unknownCount += amount;
                        return;
                }
                chestsTableBody.appendChild(buildTableRow(label, amount));
            });
            if (unknownCount > 0) {
                chestsTableBody.appendChild(buildTableRow("Other Chests", unknownCount));
            }
            break;
    }
}
function buildTableRow(label, amount) {
    const labelColumn = document.createElement("td");
    labelColumn.innerText = label;
    const amountColumn = document.createElement("td");
    amountColumn.innerText = amount.toString();
    const row = document.createElement("tr");
    row.classList.add("table-primary");
    row.appendChild(labelColumn);
    row.appendChild(amountColumn);
    return row;
}
