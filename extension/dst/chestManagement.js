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
document.addEventListener("DOMContentLoaded", loaded);
const REQUEST_DELAY = 2000;
let _buyCountRange, _buyCountNumber;
let _openCountRange, _openCountNumber;
let _blacksmithCountRange, _blacksmithCountNumber;
let _server;
let _instanceId;
let _userData;
let _shownCloseClientWarning = false;
let _blacksmithAggregate;
function loaded() {
    document.getElementById("refreshInventory").addEventListener('click', refreshClick);
    document.getElementById("purchaseButton").addEventListener('click', purchaseClick);
    document.getElementById("openButton").addEventListener('click', openClick);
    document.getElementById("blacksmithButton").addEventListener('click', blacksmithClick);
    document.getElementById("buyChestType")?.addEventListener('change', setMaximumValues);
    document.getElementById("openChestType")?.addEventListener('change', setMaximumValues);
    document.getElementById("blackithContracType")?.addEventListener('change', setMaximumValues);
    document.getElementById("heroId")?.addEventListener('change', updateSelectedHero);
    _buyCountRange = document.getElementById("buyCountRange");
    _buyCountNumber = document.getElementById("buyCountNumber");
    _buyCountRange.oninput = buyRangeChanged;
    _buyCountNumber.oninput = buyNumberChanged;
    _openCountRange = document.getElementById("openCountRange");
    _openCountNumber = document.getElementById("openCountNumber");
    _openCountRange.oninput = openRangeChanged;
    _openCountNumber.oninput = openNumberChanged;
    _blacksmithCountRange = document.getElementById("blacksmithCountRange");
    _blacksmithCountNumber = document.getElementById("blacksmithCountNumber");
    _blacksmithCountRange.oninput = blacksmithRangeChanged;
    _blacksmithCountNumber.oninput = blacksmithNumberChanged;
}
function buyRangeChanged() {
    _buyCountNumber.value = _buyCountRange.value;
}
function buyNumberChanged() {
    if (parseInt(_buyCountNumber.value) > parseInt(_buyCountNumber.max)) {
        _buyCountNumber.value = _buyCountNumber.max;
    }
    _buyCountRange.value = _buyCountNumber.value;
}
function openRangeChanged() {
    _openCountNumber.value = _openCountRange.value;
}
function openNumberChanged() {
    if (parseInt(_openCountNumber.value) > parseInt(_openCountNumber.max)) {
        _openCountNumber.value = _openCountNumber.max;
    }
    _openCountRange.value = _openCountNumber.value;
}
function blacksmithRangeChanged() {
    _blacksmithCountNumber.value = _blacksmithCountRange.value;
}
function blacksmithNumberChanged() {
    if (parseInt(_blacksmithCountNumber.value) > parseInt(_blacksmithCountNumber.max)) {
        _blacksmithCountNumber.value = _blacksmithCountNumber.max;
    }
    _blacksmithCountRange.value = _blacksmithCountNumber.value;
}
function refreshClick() {
    hideMessages();
    chrome.storage.sync.get([Globals.SETTING_USER_ID, Globals.SETTING_USER_HASH], ({ userId, userHash }) => {
        refreshInventory(userId, userHash);
    });
}
async function refreshInventory(userId, hash) {
    if (!userId || userId.length == 0 || !hash || hash.length == 0) {
        showError("No credentials entered.");
        return;
    }
    if (!_server) {
        _server = await IdleChampionsApi.getServer();
        console.log(`Got server ${_server}`);
    }
    if (!_server) {
        showError("Failed to get idle champions server.");
        return;
    }
    let userDetailsResponse = await IdleChampionsApi.getUserDetails({
        server: _server,
        user_id: userId,
        hash: hash,
    });
    if (IdleChampionsApi.isGenericResponse(userDetailsResponse)) {
        if (userDetailsResponse.status == ResponseStatus.Failed) {
            showError("Failed to retreive user data.");
            return;
        }
        if (userDetailsResponse.status == ResponseStatus.SwitchServer && userDetailsResponse.newServer) {
            console.log(`Got switch server to '${userDetailsResponse.newServer}'.`);
            _server = userDetailsResponse.newServer;
            userDetailsResponse = await IdleChampionsApi.getUserDetails({
                server: _server,
                user_id: userId,
                hash: hash,
            });
            if (IdleChampionsApi.isGenericResponse(userDetailsResponse)) {
                showError("Failed to retreive user data.");
                return;
            }
        }
    }
    _userData = userDetailsResponse;
    console.log("Refreshed inventory data.");
    console.debug(_userData);
    _instanceId = _userData.details.instance_id;
    chrome.storage.sync.set({ [Globals.SETTING_INSTANCE_ID]: _userData.details.instance_id });
    document.getElementById("gemCount").textContent = _userData.details.red_rubies.toLocaleString();
    document.getElementById("silverChestCount").textContent = _userData.details.chests[1]?.toLocaleString() || "0";
    document.getElementById("goldChestCount").textContent = _userData.details.chests[2]?.toLocaleString() || "0";
    document.getElementById("electrumChestCount").textContent = _userData.details.chests[282]?.toLocaleString() || "0";
    document.getElementById("whiteBlacksmithCount").textContent = findBuffCount(31..toString()).toLocaleString() || "0";
    document.getElementById("greenBlacksmithCount").textContent = findBuffCount(32..toString()).toLocaleString() || "0";
    document.getElementById("blueBlacksmithCount").textContent = findBuffCount(33..toString()).toLocaleString() || "0";
    document.getElementById("purpleBlacksmithCount").textContent = findBuffCount(34..toString()).toLocaleString() || "0";
    setMaximumValues();
    updateSelectedHero();
    document.getElementById("actionTabs").classList.add("show");
}
function findBuffCount(buff_id) {
    var countString = _userData?.details?.buffs?.find(b => b.buff_id == buff_id.toString())?.inventory_amount;
    return parseInt(countString ?? "0");
}
function setMaximumValues() {
    if (!_userData)
        return;
    const gems = _userData.details.red_rubies;
    let buyMax = 0;
    switch (document.getElementById("buyChestType").value) {
        case 1..toString():
            buyMax = Math.trunc(gems / 50);
            break;
        case 2..toString():
            buyMax = Math.trunc(gems / 500);
            break;
    }
    document.getElementById("buyCountRange").max = buyMax.toString();
    document.getElementById("buyCountRange").value = buyMax.toString();
    document.getElementById("buyCountNumber").max = buyMax.toString();
    document.getElementById("buyCountNumber").value = buyMax.toString();
    const chestType = document.getElementById("openChestType").value;
    const openMax = _userData.details.chests[chestType] ?? 0;
    document.getElementById("openCountRange").max = openMax.toString();
    document.getElementById("openCountRange").value = openMax.toString();
    document.getElementById("openCountNumber").max = openMax.toString();
    document.getElementById("openCountNumber").value = openMax.toString();
    const contractType = document.getElementById("blackithContracType").value;
    const blacksmithMax = findBuffCount(contractType);
    document.getElementById("blacksmithCountRange").max = blacksmithMax.toString();
    document.getElementById("blacksmithCountRange").value = blacksmithMax.toString();
    document.getElementById("blacksmithCountNumber").max = blacksmithMax.toString();
    document.getElementById("blacksmithCountNumber").value = blacksmithMax.toString();
}
function updateSelectedHero() {
    const heroId = document.getElementById("heroId").value;
    if (_blacksmithAggregate?.heroId != heroId) {
        _blacksmithAggregate = new BlacksmithAggregateResult(heroId, _userData);
    }
    else {
        _blacksmithAggregate.UpdateLevels(_userData);
    }
    displayBlacksmithResults();
}
function purchaseClick() {
    hideMessages();
    chrome.storage.sync.get([Globals.SETTING_USER_ID, Globals.SETTING_USER_HASH], ({ userId, userHash }) => {
        purchaseChests(userId, userHash);
    });
}
async function purchaseChests(userId, hash) {
    if (!_server)
        return;
    const chestType = document.getElementById("buyChestType").value;
    const chestAmount = parseInt(document.getElementById("buyCountRange").value) || 0;
    if (!chestType || chestAmount < 1) {
        return;
    }
    let remainingChests = chestAmount;
    while (remainingChests > 0) {
        showInfo(`Purchasing... ${remainingChests} chests remaining to purchase`);
        const currentAmount = Math.min(remainingChests, IdleChampionsApi.MAX_BUY_CHESTS);
        remainingChests -= currentAmount;
        console.log(`Purchasing ${currentAmount} chests`);
        const responseStatus = await IdleChampionsApi.purchaseChests({
            server: _server,
            user_id: userId,
            hash: hash,
            chestTypeId: chestType,
            count: currentAmount
        });
        if (responseStatus.status == ResponseStatus.SwitchServer && responseStatus.newServer) {
            _server = responseStatus.newServer;
            remainingChests += currentAmount;
            console.log("Switching server");
        }
        if (responseStatus.status == ResponseStatus.InsuficcientCurrency) {
            showError("Insufficient gems remaining");
            return;
        }
        else if (responseStatus.status == ResponseStatus.Failed) {
            showError("Purchase failed");
            return;
        }
        if (remainingChests > 0) {
            await new Promise(h => setTimeout(h, REQUEST_DELAY));
        }
    }
    console.log("Completed purchase");
    await refreshInventory(userId, hash);
    showSuccess(`Purchased ${chestAmount} chests`);
}
function openClick() {
    hideMessages();
    chrome.storage.sync.get([Globals.SETTING_USER_ID, Globals.SETTING_USER_HASH], ({ userId, userHash }) => {
        openChests(userId, userHash);
    });
}
function blacksmithClick() {
    hideMessages();
    chrome.storage.sync.get([Globals.SETTING_USER_ID, Globals.SETTING_USER_HASH], ({ userId, userHash }) => {
        useBlacksmithContracts(userId, userHash);
    });
}
async function openChests(userId, hash) {
    if (!_server || !_instanceId)
        return;
    if (!_shownCloseClientWarning) {
        showOpenWarning("You MUST close the client before calling open chests. Click open again to confirm.");
        _shownCloseClientWarning = true;
        return;
    }
    _shownCloseClientWarning = false;
    let lootResults = new LootAggregateResult();
    const chestType = document.getElementById("openChestType").value;
    const chestAmount = parseInt(document.getElementById("openCountRange").value) || 0;
    if (!chestType || chestAmount < 1) {
        return;
    }
    let remainingChests = chestAmount;
    while (remainingChests > 0) {
        showInfo(`Opening... ${remainingChests} chests remaining to open`);
        const currentAmount = Math.min(remainingChests, IdleChampionsApi.MAX_OPEN_CHESTS);
        remainingChests -= currentAmount;
        console.log(`Opening ${currentAmount} chests`);
        const openResponse = await IdleChampionsApi.openChests({
            server: _server,
            user_id: userId,
            hash: hash,
            chestTypeId: chestType,
            count: currentAmount,
            instanceId: _instanceId,
        });
        if (IdleChampionsApi.isGenericResponse(openResponse)) {
            if (openResponse.status == ResponseStatus.SwitchServer && openResponse.newServer) {
                _server = openResponse.newServer;
                remainingChests += currentAmount;
                console.log("Switching server");
            }
            if (openResponse.status == ResponseStatus.OutdatedInstanceId) {
                const lastInstanceId = _instanceId;
                console.log("Refreshing inventory for instance ID");
                await refreshInventory(userId, hash);
                if (_instanceId == lastInstanceId) {
                    showError("Failed to get updated instance ID. Check credentials.");
                    return;
                }
                remainingChests += currentAmount;
            }
            else if (openResponse.status == ResponseStatus.Failed) {
                showError("Purchase failed");
                return;
            }
        }
        else {
            aggregateOpenResults(openResponse.lootDetail, lootResults);
        }
        displayLootResults(lootResults);
        if (remainingChests > 0) {
            await new Promise(h => setTimeout(h, REQUEST_DELAY));
        }
    }
    console.log("Completed opening");
    await refreshInventory(userId, hash);
    showSuccess(`Opened ${chestAmount} chests`);
}
function hideMessages() {
    document.getElementById("error").classList.remove("show");
    document.getElementById("openWarning").classList.remove("show");
    document.getElementById("success").classList.remove("show");
    document.getElementById("info").classList.remove("show");
}
function showError(text) {
    console.error(text);
    hideMessages();
    document.getElementById("error").classList.add("show");
    document.querySelector("#error span").innerHTML = text;
}
function showOpenWarning(text) {
    hideMessages();
    document.getElementById("openWarning").classList.add("show");
    document.querySelector("#openWarning span").innerHTML = text;
}
function showInfo(text) {
    hideMessages();
    document.getElementById("info").classList.add("show");
    document.querySelector("#info span").innerHTML = text;
}
function showSuccess(text) {
    hideMessages();
    document.getElementById("success").classList.add("show");
    document.querySelector("#success span").innerHTML = text;
}
class LootAggregateResult {
    gems = 0;
    shinies = 0;
    commonBounties = 0;
    uncommonBounties = 0;
    rareBounties = 0;
    epicBounties = 0;
    commonBlacksmith = 0;
    uncommonBlacksmith = 0;
    rareBlacksmith = 0;
    epicBlacksmith = 0;
}
function aggregateOpenResults(loot, aggregateResult) {
    aggregateResult.shinies += loot.filter(l => l.gilded).length;
    aggregateResult.commonBounties += loot.filter(l => l.add_inventory_buff_id == 17).length;
    aggregateResult.uncommonBounties += loot.filter(l => l.add_inventory_buff_id == 18).length;
    aggregateResult.rareBounties += loot.filter(l => l.add_inventory_buff_id == 19).length;
    aggregateResult.epicBounties += loot.filter(l => l.add_inventory_buff_id == 20).length;
    aggregateResult.commonBlacksmith += loot.filter(l => l.add_inventory_buff_id == 31).length;
    aggregateResult.uncommonBlacksmith += loot.filter(l => l.add_inventory_buff_id == 32).length;
    aggregateResult.rareBlacksmith += loot.filter(l => l.add_inventory_buff_id == 33).length;
    aggregateResult.epicBlacksmith += loot.filter(l => l.add_inventory_buff_id == 34).length;
    aggregateResult.gems += loot.reduce((count, l) => count + (l.add_soft_currency ?? 0), 0);
}
function displayLootResults(aggregateResult) {
    document.querySelector("#chestLoot tbody").innerHTML = "";
    addTableRow("Shinies", aggregateResult.shinies);
    addTableRow("Gems", aggregateResult.gems);
    addTableRow("Tiny Bounty Contract", aggregateResult.commonBounties, "rarity-common");
    addTableRow("Small Bounty Contract", aggregateResult.uncommonBounties, "rarity-uncommon");
    addTableRow("Medium Bounty Contract", aggregateResult.rareBounties, "rarity-rare");
    addTableRow("Large Bounty Contract", aggregateResult.epicBounties, "rarity-epic");
    addTableRow("Tiny Blacksmithing Contract", aggregateResult.commonBlacksmith, "rarity-common");
    addTableRow("Small Blacksmithing Contract", aggregateResult.uncommonBlacksmith, "rarity-uncommon");
    addTableRow("Medium Blacksmithing Contract", aggregateResult.rareBlacksmith, "rarity-rare");
    addTableRow("Large Blacksmithing Contract", aggregateResult.epicBlacksmith, "rarity-epic");
}
function addTableRow(text, amount, style) {
    if (amount == 0)
        return;
    let tbody = document.querySelector("#chestLoot tbody");
    tbody.append(buildTableRow(text, amount, style));
}
function buildTableRow(label, amount, style) {
    const labelColumn = document.createElement("td");
    labelColumn.innerText = label;
    const amountColumn = document.createElement("td");
    amountColumn.innerText = amount.toString();
    const row = document.createElement("tr");
    if (style) {
        row.classList.add(style);
    }
    row.appendChild(labelColumn);
    row.appendChild(amountColumn);
    return row;
}
class BlacksmithAggregateResult {
    heroId;
    slotResult = new Array(7);
    slotEndValue = new Array(7);
    constructor(heroId, userData) {
        this.heroId = heroId;
        this.UpdateLevels(userData);
    }
    UpdateLevels(userData) {
        userData?.details?.loot?.filter(l => l.hero_id == parseInt(this.heroId)).forEach(lootItem => {
            this.slotEndValue[lootItem.slot_id] = lootItem.enchant + 1;
        });
    }
}
async function useBlacksmithContracts(userId, hash) {
    if (!_server || !_instanceId)
        return;
    const contractType = document.getElementById("blackithContracType").value;
    const heroId = document.getElementById("heroId").value;
    const blacksmithAmount = parseInt(_blacksmithCountRange.value) || 0;
    updateSelectedHero();
    if (!contractType || !heroId || blacksmithAmount < 1) {
        return;
    }
    let remainingContracts = blacksmithAmount;
    while (remainingContracts > 0) {
        showInfo(`Smithing... ${remainingContracts} contracts remaining to use`);
        const currentAmount = Math.min(remainingContracts, IdleChampionsApi.MAX_BLACKSMITH);
        remainingContracts -= currentAmount;
        console.log(`Using ${currentAmount} contracts`);
        const blacksmithResponse = await IdleChampionsApi.useBlacksmith({
            server: _server,
            user_id: userId,
            hash: hash,
            heroId: heroId,
            contractType: contractType,
            count: currentAmount,
            instanceId: _instanceId,
        });
        if (IdleChampionsApi.isGenericResponse(blacksmithResponse)) {
            if (blacksmithResponse.status == ResponseStatus.SwitchServer && blacksmithResponse.newServer) {
                _server = blacksmithResponse.newServer;
                remainingContracts += currentAmount;
                console.log("Switching server");
            }
            if (blacksmithResponse.status == ResponseStatus.OutdatedInstanceId) {
                const lastInstanceId = _instanceId;
                console.log("Refreshing inventory for instance ID");
                await refreshInventory(userId, hash);
                if (_instanceId == lastInstanceId) {
                    showError("Failed to get updated instance ID. Check credentials.");
                    return;
                }
                remainingContracts += currentAmount;
            }
            else if (blacksmithResponse.status == ResponseStatus.Failed) {
                showError("Blacksmithing failed");
                return;
            }
        }
        else {
            aggregateBlacksmithResults(blacksmithResponse.actions);
        }
        displayBlacksmithResults();
        if (remainingContracts > 0) {
            await new Promise(h => setTimeout(h, REQUEST_DELAY));
        }
    }
    console.log("Completed blacksmithing");
    await refreshInventory(userId, hash);
    showSuccess(`Used ${blacksmithAmount} blacksmith contracts`);
}
function aggregateBlacksmithResults(blacksmithActions) {
    blacksmithActions.forEach(action => {
        if (action.action == "level_up_loot") {
            var newLevels = parseInt(action.amount);
            _blacksmithAggregate.slotResult[action.slot_id] = (_blacksmithAggregate.slotResult[action.slot_id] ?? 0) + newLevels;
            _blacksmithAggregate.slotEndValue[action.slot_id] = action.enchant_level + 1;
        }
    });
}
function displayBlacksmithResults() {
    document.querySelector("#blacksmithResults tbody").innerHTML = "";
    for (let i = 1; i <= 6; i++) {
        addBlacksmithTableRow("Slot " + i, _blacksmithAggregate.slotResult[i], _blacksmithAggregate.slotEndValue[i]);
    }
}
function addBlacksmithTableRow(text, amount, newLevel, style) {
    let tbody = document.querySelector("#blacksmithResults tbody");
    tbody.append(buildBlacksmithTableRow(text, amount, newLevel, style));
}
function buildBlacksmithTableRow(slotName, addedLevels, newLevel, style) {
    const slotColumn = document.createElement("td");
    slotColumn.innerText = slotName;
    const addedLevelsColumn = document.createElement("td");
    addedLevelsColumn.innerText = addedLevels?.toString() || "0";
    const newLevelColumn = document.createElement("td");
    newLevelColumn.innerText = newLevel?.toString() || "0";
    const row = document.createElement("tr");
    if (style) {
        row.classList.add(style);
    }
    row.appendChild(slotColumn);
    row.appendChild(addedLevelsColumn);
    row.appendChild(newLevelColumn);
    return row;
}
