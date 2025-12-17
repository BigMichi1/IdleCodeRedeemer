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
class GenericResponse {
    status;
    newServer;
    constructor(status, newServer) {
        this.status = status;
        this.newServer = newServer ? newServer + "post.php" : undefined;
    }
}
class CodeSubmitResponse {
    codeStatus;
    lootDetail;
    constructor(codeStatus, lootDetail) {
        this.codeStatus = codeStatus;
        this.lootDetail = lootDetail;
    }
}
class OpenChestResponse {
    lootDetail;
    constructor(lootDetail) {
        this.lootDetail = lootDetail;
    }
}
class UseBlacksmithResponse {
    actions;
    constructor(actions) {
        this.actions = actions;
    }
}
var CodeSubmitStatus;
(function (CodeSubmitStatus) {
    CodeSubmitStatus[CodeSubmitStatus["Success"] = 0] = "Success";
    CodeSubmitStatus[CodeSubmitStatus["AlreadyRedeemed"] = 1] = "AlreadyRedeemed";
    CodeSubmitStatus[CodeSubmitStatus["InvalidParameters"] = 2] = "InvalidParameters";
    CodeSubmitStatus[CodeSubmitStatus["NotValidCombo"] = 3] = "NotValidCombo";
    CodeSubmitStatus[CodeSubmitStatus["Expired"] = 4] = "Expired";
    CodeSubmitStatus[CodeSubmitStatus["CannotRedeem"] = 5] = "CannotRedeem";
})(CodeSubmitStatus || (CodeSubmitStatus = {}));
var ResponseStatus;
(function (ResponseStatus) {
    ResponseStatus[ResponseStatus["Success"] = 0] = "Success";
    ResponseStatus[ResponseStatus["OutdatedInstanceId"] = 1] = "OutdatedInstanceId";
    ResponseStatus[ResponseStatus["Failed"] = 2] = "Failed";
    ResponseStatus[ResponseStatus["InsuficcientCurrency"] = 3] = "InsuficcientCurrency";
    ResponseStatus[ResponseStatus["SwitchServer"] = 4] = "SwitchServer";
})(ResponseStatus || (ResponseStatus = {}));
class IdleChampionsApi {
    static CLIENT_VERSION = "999";
    static NETWORK_ID = "21";
    static LANGUAGE_ID = "1";
    static MAX_BUY_CHESTS = 250;
    static MAX_OPEN_CHESTS = 1000;
    static MAX_BLACKSMITH = 1000;
    static async getServer() {
        const request = new URL('https://master.idlechampions.com/~idledragons/post.php');
        request.searchParams.append("call", "getPlayServerForDefinitions");
        request.searchParams.append("mobile_client_version", "999");
        request.searchParams.append("network_id", IdleChampionsApi.NETWORK_ID);
        request.searchParams.append("timestamp", "0");
        request.searchParams.append("request_id", "0");
        request.searchParams.append("localization_aware", "true");
        const response = await fetch(request.toString());
        if (response.ok) {
            const serverDefs = await IdleChampionsApi.tryToJson(response);
            if (serverDefs) {
                return serverDefs.play_server + "post.php";
            }
        }
        return undefined;
    }
    static async submitCode(options) {
        const request = new URL(options.server);
        request.searchParams.append("call", "redeemcoupon");
        request.searchParams.append("user_id", options.user_id);
        request.searchParams.append("hash", options.hash);
        request.searchParams.append("code", options.code);
        request.searchParams.append("instance_id", options.instanceId);
        request.searchParams.append("timestamp", "0");
        request.searchParams.append("request_id", "0");
        request.searchParams.append("language_id", IdleChampionsApi.LANGUAGE_ID);
        request.searchParams.append("network_id", IdleChampionsApi.NETWORK_ID);
        request.searchParams.append("mobile_client_version", IdleChampionsApi.CLIENT_VERSION);
        request.searchParams.append("localization_aware", "true");
        const response = await fetch(request.toString());
        if (response.ok) {
            const redeemResponse = await IdleChampionsApi.tryToJson(response);
            if (!redeemResponse) {
                return new GenericResponse(ResponseStatus.Failed);
            }
            console.debug(redeemResponse);
            if (redeemResponse.switch_play_server) {
                return new GenericResponse(ResponseStatus.SwitchServer, redeemResponse.switch_play_server);
            }
            if (redeemResponse.failure_reason === "you_already_redeemed_combination" ||
                redeemResponse.failure_reason === "someone_already_redeemed_combination") {
                return new CodeSubmitResponse(CodeSubmitStatus.AlreadyRedeemed);
            }
            if (redeemResponse.failure_reason === "offer_has_expired") {
                return new CodeSubmitResponse(CodeSubmitStatus.Expired);
            }
            if (redeemResponse.failure_reason === "not_valid_combination") {
                return new CodeSubmitResponse(CodeSubmitStatus.NotValidCombo);
            }
            if (redeemResponse.failure_reason === "Outdated instance id") {
                return new GenericResponse(ResponseStatus.OutdatedInstanceId);
            }
            if (redeemResponse.failure_reason === "Invalid or incomplete parameters") {
                return new CodeSubmitResponse(CodeSubmitStatus.InvalidParameters);
            }
            if (redeemResponse.failure_reason === "can_not_redeem_combination") {
                return new CodeSubmitResponse(CodeSubmitStatus.CannotRedeem);
            }
            if (redeemResponse.success && redeemResponse.okay) {
                return new CodeSubmitResponse(CodeSubmitStatus.Success, redeemResponse?.loot_details);
            }
            console.error("Unknown failure reason");
            return new GenericResponse(ResponseStatus.Failed);
        }
        return new GenericResponse(ResponseStatus.Failed);
    }
    static async getUserDetails(options) {
        const request = new URL(options.server);
        request.searchParams.append("call", "getuserdetails");
        request.searchParams.append("user_id", options.user_id);
        request.searchParams.append("hash", options.hash);
        request.searchParams.append("instance_key", "0");
        request.searchParams.append("include_free_play_objectives", "true");
        request.searchParams.append("timestamp", "0");
        request.searchParams.append("request_id", "0");
        request.searchParams.append("language_id", IdleChampionsApi.LANGUAGE_ID);
        request.searchParams.append("network_id", IdleChampionsApi.NETWORK_ID);
        request.searchParams.append("mobile_client_version", IdleChampionsApi.CLIENT_VERSION);
        request.searchParams.append("localization_aware", "true");
        const response = await fetch(request.toString());
        if (response.ok) {
            const playerData = await IdleChampionsApi.tryToJson(response);
            if (playerData.switch_play_server) {
                return new GenericResponse(ResponseStatus.SwitchServer, playerData.switch_play_server);
            }
            if (playerData?.success) {
                return playerData;
            }
        }
        return new GenericResponse(ResponseStatus.Failed);
    }
    static async openChests(options) {
        const request = new URL(options.server);
        if (options.count > IdleChampionsApi.MAX_OPEN_CHESTS)
            throw new Error("Count limited to IdleChampionsApi.MAX_OPEN_CHESTS opened per call.");
        request.searchParams.append("call", "openGenericChest");
        request.searchParams.append("user_id", options.user_id);
        request.searchParams.append("hash", options.hash);
        request.searchParams.append("chest_type_id", options.chestTypeId.toString());
        request.searchParams.append("count", options.count.toString());
        request.searchParams.append("instance_id", options.instanceId);
        request.searchParams.append("gold_per_second", "0.00");
        request.searchParams.append("game_instance_id", "1");
        request.searchParams.append("checksum", "d99242bc7924646a5e069bc39eeb735b");
        request.searchParams.append("timestamp", "0");
        request.searchParams.append("request_id", "0");
        request.searchParams.append("language_id", IdleChampionsApi.LANGUAGE_ID);
        request.searchParams.append("network_id", IdleChampionsApi.NETWORK_ID);
        request.searchParams.append("localization_aware", "true");
        const response = await fetch(request.toString());
        if (response.ok) {
            const openGenericChestResponse = await IdleChampionsApi.tryToJson(response);
            if (!openGenericChestResponse) {
                return new GenericResponse(ResponseStatus.Failed);
            }
            console.debug(openGenericChestResponse);
            if (openGenericChestResponse.switch_play_server) {
                return new GenericResponse(ResponseStatus.SwitchServer, openGenericChestResponse.switch_play_server);
            }
            if (openGenericChestResponse.failure_reason == "Outdated instance id") {
                return new GenericResponse(ResponseStatus.OutdatedInstanceId);
            }
            if (openGenericChestResponse.success && openGenericChestResponse.loot_details) {
                return new OpenChestResponse(openGenericChestResponse.loot_details);
            }
        }
        return new GenericResponse(ResponseStatus.Failed);
    }
    static async purchaseChests(options) {
        const request = new URL(options.server);
        if (options.count > IdleChampionsApi.MAX_BUY_CHESTS)
            throw new Error("Count limited to IdleChampionsApi.MAX_BUY_CHESTS purchased per call.");
        request.searchParams.append("call", "buysoftcurrencychest");
        request.searchParams.append("user_id", options.user_id);
        request.searchParams.append("hash", options.hash);
        request.searchParams.append("chest_type_id", options.chestTypeId.toString());
        request.searchParams.append("count", options.count.toString());
        request.searchParams.append("timestamp", "0");
        request.searchParams.append("request_id", "0");
        request.searchParams.append("network_id", IdleChampionsApi.NETWORK_ID);
        request.searchParams.append("localization_aware", "true");
        request.searchParams.append("mobile_client_version", "999");
        request.searchParams.append("language_id", IdleChampionsApi.LANGUAGE_ID);
        const response = await fetch(request.toString());
        if (response.ok) {
            const purchaseResponse = await IdleChampionsApi.tryToJson(response);
            if (!purchaseResponse) {
                return new GenericResponse(ResponseStatus.Failed);
            }
            console.debug(purchaseResponse);
            if (purchaseResponse.switch_play_server) {
                return new GenericResponse(ResponseStatus.SwitchServer, purchaseResponse.switch_play_server);
            }
            if (purchaseResponse.failure_reason == "Not enough currency") {
                return new GenericResponse(ResponseStatus.InsuficcientCurrency);
            }
            if (purchaseResponse.success && purchaseResponse.okay) {
                return new GenericResponse(ResponseStatus.Success);
            }
        }
        return new GenericResponse(ResponseStatus.Failed);
    }
    static async useBlacksmith(options) {
        const request = new URL(options.server);
        if (options.count > IdleChampionsApi.MAX_BLACKSMITH)
            throw new Error("Count limited to IdleChampionsApi.MAX_BLACKSMITH per call.");
        request.searchParams.append("call", "useServerBuff");
        request.searchParams.append("user_id", options.user_id);
        request.searchParams.append("hash", options.hash);
        request.searchParams.append("buff_id", options.contractType.toString());
        request.searchParams.append("hero_id", options.heroId);
        request.searchParams.append("num_uses", options.count.toString());
        request.searchParams.append("instance_id", options.instanceId);
        request.searchParams.append("game_instance_id", "1");
        request.searchParams.append("timestamp", "0");
        request.searchParams.append("request_id", "0");
        request.searchParams.append("language_id", IdleChampionsApi.LANGUAGE_ID);
        request.searchParams.append("network_id", IdleChampionsApi.NETWORK_ID);
        request.searchParams.append("localization_aware", "true");
        const response = await fetch(request.toString());
        if (response.ok) {
            const useServerBuffResponse = await IdleChampionsApi.tryToJson(response);
            if (!useServerBuffResponse) {
                return new GenericResponse(ResponseStatus.Failed);
            }
            console.debug(useServerBuffResponse);
            if (useServerBuffResponse.switch_play_server) {
                return new GenericResponse(ResponseStatus.SwitchServer, useServerBuffResponse.switch_play_server);
            }
            if (useServerBuffResponse.failure_reason == "Outdated instance id") {
                return new GenericResponse(ResponseStatus.OutdatedInstanceId);
            }
            if (useServerBuffResponse.success && useServerBuffResponse.okay) {
                return new UseBlacksmithResponse(useServerBuffResponse.actions);
            }
        }
        return new GenericResponse(ResponseStatus.Failed);
    }
    static async tryToJson(response) {
        try {
            return await response.json();
        }
        catch (e) {
            console.error(e);
            return null;
        }
    }
    static isGenericResponse(response) {
        return response instanceof GenericResponse;
    }
}
const REQUEST_DELAY = 2000;
let _waitingForPagePort = false;
let _optionsPort;
chrome.runtime.onConnect.addListener((port) => {
    if (port.name == "page") {
        if (_waitingForPagePort) {
            console.log("New port opened.");
            _waitingForPagePort = false;
            port.onMessage.addListener(onPagePortMessage);
        }
        else {
            console.log("Unexpected port, disconnecting.");
            port.disconnect();
        }
    }
    else if (port.name == "options") {
        _optionsPort?.disconnect();
        port.onMessage.addListener(onOptionsPortMessage);
        _optionsPort = port;
    }
});
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        contexts: ["action"],
        title: "Open chest management",
        id: "ChestManagement"
    });
});
chrome.contextMenus.onClicked.addListener(onOpenExtensionPageClick);
function onOpenExtensionPageClick(info, tab) {
    if (info?.menuItemId == "ChestManagement") {
        chrome.tabs.create({ url: "dst/chestManagement.html" });
    }
}
function onPagePortMessage(message, port) {
    switch (message.messageType) {
        case "pageReady":
            console.log("Page ready message");
            port.postMessage({ messageType: "scanCodes" });
            break;
        case "codes":
            console.log("Code message received");
            chrome.storage.sync.get([Globals.SETTING_CODES, Globals.SETTING_PENDING], ({ redeemedCodes, pendingCodes }) => { handleDetectedCodes(redeemedCodes, pendingCodes, message.codes); });
            port.postMessage({ messageType: "closeTab" });
            port.disconnect();
            break;
    }
}
function onOptionsPortMessage(message, port) {
    if (message.messageType == "pageReady") {
        port.postMessage({ messageType: "info", messageText: `Opening discord tab to scan for codes.` });
        console.log("Starting scan/upolad process. Opening discord tab.");
        _waitingForPagePort = true;
        chrome.tabs.create({ url: Globals.discordChannelUrl });
        port.postMessage({ messageType: "activateTab" });
    }
}
chrome.action.onClicked.addListener(browserActionClicked);
function browserActionClicked(tab) {
    chrome.tabs.create({ url: "dst/options.html" });
}
function handleDetectedCodes(redeemedCodes, pendingCodes, detectedCodes) {
    if (!detectedCodes || detectedCodes.length == 0)
        return;
    if (!redeemedCodes)
        redeemedCodes = [];
    if (!pendingCodes)
        pendingCodes = [];
    let detectedCode;
    while (detectedCode = detectedCodes.pop()) {
        if (!redeemedCodes.includes(detectedCode) && !pendingCodes.includes(detectedCode)) {
            console.log(`New code detected: ${detectedCode}`);
            pendingCodes.push(detectedCode);
        }
        else if (pendingCodes.includes(detectedCode)) {
            console.debug(`Duplicate pending code: ${detectedCode}`);
        }
        else {
            console.debug(`Duplicate redeemed code: ${detectedCode}`);
        }
    }
    if (pendingCodes.length > 0) {
        console.log("New codes detected, saving list.");
        console.debug(pendingCodes);
        chrome.storage.sync.set({ [Globals.SETTING_CODES]: redeemedCodes, [Globals.SETTING_PENDING]: pendingCodes }, () => {
            startUploadProcess();
        });
    }
    else {
        console.log("No new codes detected.");
        _optionsPort.postMessage({ messageType: "info", messageText: `No new codes detected.` });
    }
}
function startUploadProcess() {
    chrome.storage.sync.get([Globals.SETTING_CODES, Globals.SETTING_PENDING, Globals.SETTING_INSTANCE_ID, Globals.SETTING_USER_ID, Globals.SETTING_USER_HASH], ({ redeemedCodes, pendingCodes, instanceId, userId, userHash }) => {
        console.log("Beginning upload.");
        uploadCodes(redeemedCodes, pendingCodes, instanceId, userId, userHash);
    });
}
async function uploadCodes(reedemedCodes, pendingCodes, instanceId, userId, hash) {
    if (!userId || userId.length == 0 || !hash || hash.length == 0) {
        _optionsPort.postMessage({ messageType: "missingCredentials" });
        console.error("No credentials entered.");
        return;
    }
    let server = await IdleChampionsApi.getServer();
    if (!server) {
        console.error("Failed to get idle champions server.");
        _optionsPort.postMessage({ messageType: "error", messageText: "Unable to connect to Idle Champions server." });
        return;
    }
    console.log(`Got server ${server}`);
    _optionsPort.postMessage({ messageType: "info", messageText: `Upload starting, ${pendingCodes.length} new codes to redeem. This may take a bit.` });
    let duplicates = 0, newCodes = 0, expired = 0, invalid = 0, cannotRedeem = 0;
    const chests = {};
    let heroUnlocks = 0, skinUnlocks = 0;
    let code;
    while (code = pendingCodes.pop()) {
        await new Promise(h => setTimeout(h, REQUEST_DELAY));
        console.log(`Attempting to upload code: ${code}`);
        let codeResponse = await IdleChampionsApi.submitCode({
            server: server,
            user_id: userId,
            hash: hash,
            instanceId: instanceId,
            code: code
        });
        if (IdleChampionsApi.isGenericResponse(codeResponse) && codeResponse.status == ResponseStatus.SwitchServer && codeResponse.newServer) {
            console.log("Switching server");
            server = codeResponse.newServer;
            codeResponse = await IdleChampionsApi.submitCode({
                server: server,
                user_id: userId,
                hash: hash,
                instanceId: instanceId,
                code: code
            });
        }
        if (IdleChampionsApi.isGenericResponse(codeResponse) && codeResponse.status == ResponseStatus.OutdatedInstanceId) {
            console.log("Instance ID outdated, refreshing.");
            await new Promise(h => setTimeout(h, REQUEST_DELAY));
            const userData = await IdleChampionsApi.getUserDetails({
                server: server,
                user_id: userId,
                hash: hash,
            });
            if (IdleChampionsApi.isGenericResponse(userData)) {
                console.log("Failed to retreive user data.");
                _optionsPort.postMessage({ messageType: "error", messageText: "Failed to retreieve user data, check user ID and hash." });
                return;
            }
            else {
                instanceId = userData.details.instance_id;
            }
            chrome.storage.sync.set({ [Globals.SETTING_INSTANCE_ID]: instanceId });
            await new Promise(h => setTimeout(h, REQUEST_DELAY));
            codeResponse = await IdleChampionsApi.submitCode({
                server: server,
                user_id: userId,
                hash: hash,
                instanceId: instanceId,
                code: code
            });
        }
        if (IdleChampionsApi.isGenericResponse(codeResponse)) {
            console.error("Unable to submit code, aborting upload process.");
            _optionsPort.postMessage({ messageType: "error", messageText: "Failed to submit code for unknown reason." });
            return;
        }
        else {
            switch (codeResponse.codeStatus) {
                case CodeSubmitStatus.InvalidParameters:
                    console.error("Unable to submit code due to invalid parameters.");
                    _optionsPort.postMessage({ messageType: "error", messageText: "Failed to submit code, check user/hash on settings tab." });
                    return;
                case CodeSubmitStatus.Expired:
                case CodeSubmitStatus.NotValidCombo:
                case CodeSubmitStatus.AlreadyRedeemed:
                case CodeSubmitStatus.Success:
                case CodeSubmitStatus.CannotRedeem:
                    if (codeResponse.codeStatus == CodeSubmitStatus.AlreadyRedeemed) {
                        console.log(`Already redeemed code: ${code}`);
                        duplicates++;
                    }
                    else if (codeResponse.codeStatus == CodeSubmitStatus.NotValidCombo) {
                        console.log(`Invalid code: ${code}`);
                        invalid++;
                    }
                    else if (codeResponse.codeStatus == CodeSubmitStatus.Expired) {
                        console.log(`Expired code: ${code}`);
                        expired++;
                    }
                    if (codeResponse.codeStatus == CodeSubmitStatus.CannotRedeem) {
                        console.log(`Cannot redeem: ${code}`);
                        cannotRedeem++;
                    }
                    else {
                        console.log(`Sucessfully redeemed: ${code}`);
                        codeResponse.lootDetail?.forEach(loot => {
                            switch (loot.loot_action) {
                                case "generic_chest":
                                    if (loot.chest_type_id && loot.count) {
                                        chests[loot.chest_type_id] = (chests[loot.chest_type_id] ?? 0) + loot.count;
                                    }
                                    break;
                                case "unlock_hero":
                                    heroUnlocks++;
                                    break;
                                case "claim":
                                    if (loot.unlock_hero_skin) {
                                        skinUnlocks++;
                                    }
                                    break;
                            }
                        });
                        newCodes++;
                    }
                    reedemedCodes.push(code);
                    if (reedemedCodes.length > 300) {
                        reedemedCodes.shift();
                    }
                    chrome.storage.sync.set({ [Globals.SETTING_CODES]: reedemedCodes, [Globals.SETTING_PENDING]: pendingCodes });
                    break;
            }
        }
        _optionsPort.postMessage({ messageType: "info", messageText: `Uploading... ${pendingCodes.length} codes left. This may take a bit.` });
    }
    console.log("Redeem complete:");
    console.log(`${duplicates} duplicate codes`);
    console.log(`${newCodes} new redemptions`);
    console.log(`${expired} expired`);
    console.log(`${invalid} invalid`);
    console.log(`${cannotRedeem} unable to be redeemed`);
    console.log(chests);
    _optionsPort.postMessage({
        messageType: "success",
        chests: chests,
        heroUnlocks: heroUnlocks,
        skinUnlocks: skinUnlocks,
        messageText: `Upload completed successfully:<br>
                        ${duplicates > 0 ? `${duplicates} codes already redeemed<br>` : ""}
                        ${expired > 0 ? `${expired} expired codes<br>` : ""}
                        ${invalid > 0 ? `${invalid} invalid codes<br>` : ""}
                        ${cannotRedeem > 0 ? `${cannotRedeem} unable to be redeemed<br>` : ""}
                        ${newCodes} codes redeemed`
    });
}
