/// <reference path="../../lib/player_data.d.ts" />
/// <reference path="../../lib/redeem_code_response.d.ts" />
/// <reference path="../../lib/server_definitions.d.ts" />
/// <reference path="../../lib/blacksmith_response.d.ts" />

import fetch from 'node-fetch';
import * as https from 'https';

interface CodeSubmitOptions {
  server: string;
  code: string;
  user_id: string;
  hash: string;
  instanceId: string;
}

interface GetUserDetailsOptions {
  server: string;
  user_id: string;
  hash: string;
}

interface OpenChestsOptions {
  server: string;
  user_id: string;
  hash: string;
  chestTypeId: ChestType;
  count: number;
  instanceId: string;
}

interface PurchaseChestsOptions {
  server: string;
  user_id: string;
  hash: string;
  chestTypeId: ChestType;
  count: number;
}

interface UseBlacksmithOptions {
  server: string;
  user_id: string;
  hash: string;
  contractType: ContractType;
  heroId: string;
  count: number;
  instanceId: string;
}

declare const enum ContractType {
  Tiny = 31,
  Small = 32,
  Medium = 33,
  Large = 34,
}

class IdleChampionsApi {
  private static readonly CLIENT_VERSION = '999';
  private static readonly NETWORK_ID = '21';
  private static readonly LANGUAGE_ID = '1';
  public static readonly MAX_BUY_CHESTS = 250;
  public static readonly MAX_OPEN_CHESTS = 1000;
  public static readonly MAX_BLACKSMITH = 1000;
  private static readonly httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });

  static async getServer(): Promise<string | undefined> {
    const request = new URL('https://master.idlechampions.com/~idledragons/post.php');

    request.searchParams.append('call', 'getPlayServerForDefinitions');
    request.searchParams.append('mobile_client_version', '999');
    request.searchParams.append('network_id', IdleChampionsApi.NETWORK_ID);
    request.searchParams.append('timestamp', '0');
    request.searchParams.append('request_id', '0');
    request.searchParams.append('localization_aware', 'true');

    try {
      const response = await fetch(request.toString(), { agent: this.httpsAgent } as any);
      
      if (response.ok) {
        const serverDefs: ServerDefinitions = await IdleChampionsApi.tryToJson(response);
        
        if (serverDefs && serverDefs.play_server) {
          const result = serverDefs.play_server + 'post.php';
          console.log(`[API] Server: ${result}`);
          return result;
        } else {
          console.error(`[API] No play_server in response`);
        }
      } else {
        console.error(`[API] Failed to get server: HTTP ${response.status}`);
      }
    } catch (error) {
      console.error(`[API] Error getting server:`, error);
    }
    return undefined;
  }

  static async submitCode(options: CodeSubmitOptions): Promise<GenericResponse | CodeSubmitResponse> {
    const request = new URL(options.server);

    request.searchParams.append('call', 'redeemcoupon');
    request.searchParams.append('user_id', options.user_id);
    request.searchParams.append('hash', options.hash);
    request.searchParams.append('code', options.code);
    request.searchParams.append('instance_id', options.instanceId);
    request.searchParams.append('timestamp', '0');
    request.searchParams.append('request_id', '0');
    request.searchParams.append('language_id', IdleChampionsApi.LANGUAGE_ID);
    request.searchParams.append('network_id', IdleChampionsApi.NETWORK_ID);
    request.searchParams.append('mobile_client_version', IdleChampionsApi.CLIENT_VERSION);
    request.searchParams.append('localization_aware', 'true');

    console.log(`[API] Submitting code to: ${request.toString().split('hash=')[0]}hash=***`);

    try {
      const response = await fetch(request.toString(), { agent: this.httpsAgent } as any);
      if (response.ok) {
        const redeemResponse: RedeemCodeResponse = await IdleChampionsApi.tryToJson(response);
        if (!redeemResponse) {
          return new GenericResponse(ResponseStatus.Failed);
        }
        if (redeemResponse.switch_play_server) {
          return new GenericResponse(ResponseStatus.SwitchServer, redeemResponse.switch_play_server);
        }
        
        const reason = redeemResponse.failure_reason?.toLowerCase() || '';
        
        if (reason.includes('already') || reason.includes('someone')) {
          return new CodeSubmitResponse(CodeSubmitStatus.AlreadyRedeemed);
        }
        if (reason.includes('expired')) {
          return new CodeSubmitResponse(CodeSubmitStatus.Expired);
        }
        if (reason.includes('combo') || reason.includes('invalid')) {
          return new CodeSubmitResponse(CodeSubmitStatus.NotValidCombo);
        }
        if (reason.includes('outdated')) {
          return new GenericResponse(ResponseStatus.OutdatedInstanceId);
        }
        if (reason.includes('parameter')) {
          return new CodeSubmitResponse(CodeSubmitStatus.InvalidParameters);
        }
        if (reason.includes('cannot')) {
          return new CodeSubmitResponse(CodeSubmitStatus.CannotRedeem);
        }
        if (redeemResponse.success && redeemResponse.okay) {
          return new CodeSubmitResponse(CodeSubmitStatus.Success, redeemResponse?.loot_details);
        }
        console.error('[API] Unknown failure reason:', redeemResponse.failure_reason);
        return new GenericResponse(ResponseStatus.Failed);
      }
    } catch (error) {
      console.error('[API] Error submitting code:', error);
    }
    return new GenericResponse(ResponseStatus.Failed);
  }

  static async getUserDetails(options: GetUserDetailsOptions): Promise<GenericResponse | PlayerData> {
    const request = new URL(options.server);

    request.searchParams.append('call', 'getuserdetails');
    request.searchParams.append('user_id', options.user_id);
    request.searchParams.append('hash', options.hash);
    request.searchParams.append('instance_key', '0');
    request.searchParams.append('include_free_play_objectives', 'true');
    request.searchParams.append('timestamp', '0');
    request.searchParams.append('request_id', '0');
    request.searchParams.append('language_id', IdleChampionsApi.LANGUAGE_ID);
    request.searchParams.append('network_id', IdleChampionsApi.NETWORK_ID);
    request.searchParams.append('mobile_client_version', IdleChampionsApi.CLIENT_VERSION);
    request.searchParams.append('localization_aware', 'true');

    try {
      const fetchPromise = fetch(request.toString(), { agent: this.httpsAgent } as any);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('API request timeout after 5s')), 5000)
      );
      
      const response = (await Promise.race([fetchPromise, timeoutPromise])) as any;
      
      if (response.ok) {
        const playerData: PlayerData = await IdleChampionsApi.tryToJson(response);
        if (playerData.switch_play_server) {
          return new GenericResponse(ResponseStatus.SwitchServer, playerData.switch_play_server);
        }
        if (playerData?.success) {
          return playerData;
        }
      } else {
        const text = await response.text();
        console.error(`[API] Bad response status: ${response.status}`);
        console.error(`[API] Response body (first 500 chars): ${text.substring(0, 500)}`);
      }
    } catch (error) {
      console.error('[API] Error getting user details:', error);
    }
    return new GenericResponse(ResponseStatus.Failed);
  }

  static async openChests(options: OpenChestsOptions): Promise<GenericResponse | OpenChestResponse> {
    const request = new URL(options.server);

    if (options.count > IdleChampionsApi.MAX_OPEN_CHESTS) {
      throw new Error('Count limited to IdleChampionsApi.MAX_OPEN_CHESTS opened per call.');
    }

    request.searchParams.append('call', 'openGenericChest');
    request.searchParams.append('user_id', options.user_id);
    request.searchParams.append('hash', options.hash);
    request.searchParams.append('chest_type_id', options.chestTypeId.toString());
    request.searchParams.append('count', options.count.toString());
    request.searchParams.append('instance_id', options.instanceId);
    request.searchParams.append('gold_per_second', '0.00');
    request.searchParams.append('game_instance_id', '1');
    request.searchParams.append('checksum', 'd99242bc7924646a5e069bc39eeb735b');
    request.searchParams.append('timestamp', '0');
    request.searchParams.append('request_id', '0');
    request.searchParams.append('language_id', IdleChampionsApi.LANGUAGE_ID);
    request.searchParams.append('network_id', IdleChampionsApi.NETWORK_ID);
    request.searchParams.append('localization_aware', 'true');

    console.log(`[API] Opening chests from: ${request.toString().split('hash=')[0]}hash=***`);

    try {
      const response = await fetch(request.toString(), { agent: this.httpsAgent } as any);
      if (response.ok) {
        const openGenericChestResponse: OpenGenericChestResponse = await IdleChampionsApi.tryToJson(response);
        if (!openGenericChestResponse) {
          return new GenericResponse(ResponseStatus.Failed);
        }
        if (openGenericChestResponse.switch_play_server) {
          return new GenericResponse(ResponseStatus.SwitchServer, openGenericChestResponse.switch_play_server);
        }
        if (openGenericChestResponse.failure_reason && openGenericChestResponse.failure_reason.toLowerCase().includes('outdated')) {
          return new GenericResponse(ResponseStatus.OutdatedInstanceId);
        }
        if (openGenericChestResponse.success && openGenericChestResponse.loot_details) {
          return new OpenChestResponse(openGenericChestResponse.loot_details);
        }
      }
    } catch (error) {
      console.error('[API] Error opening chests:', error);
    }
    return new GenericResponse(ResponseStatus.Failed);
  }

  static async purchaseChests(options: PurchaseChestsOptions): Promise<GenericResponse> {
    const request = new URL(options.server);

    if (options.count > IdleChampionsApi.MAX_BUY_CHESTS) {
      throw new Error('Count limited to IdleChampionsApi.MAX_BUY_CHESTS purchased per call.');
    }

    request.searchParams.append('call', 'buysoftcurrencychest');
    request.searchParams.append('user_id', options.user_id);
    request.searchParams.append('hash', options.hash);
    request.searchParams.append('chest_type_id', options.chestTypeId.toString());
    request.searchParams.append('count', options.count.toString());
    request.searchParams.append('timestamp', '0');
    request.searchParams.append('request_id', '0');
    request.searchParams.append('network_id', IdleChampionsApi.NETWORK_ID);
    request.searchParams.append('localization_aware', 'true');
    request.searchParams.append('mobile_client_version', '999');
    request.searchParams.append('language_id', IdleChampionsApi.LANGUAGE_ID);

    console.log(`[API] Purchasing chests from: ${request.toString().split('hash=')[0]}hash=***`);

    try {
      const response = await fetch(request.toString(), { agent: this.httpsAgent } as any);
      if (response.ok) {
        const purchaseResponse: PurchaseChestResponse = await IdleChampionsApi.tryToJson(response);
        if (!purchaseResponse) {
          return new GenericResponse(ResponseStatus.Failed);
        }
        if (purchaseResponse.switch_play_server) {
          return new GenericResponse(ResponseStatus.SwitchServer, purchaseResponse.switch_play_server);
        }
        if (purchaseResponse.failure_reason == FailureReason.NotEnoughCurrency) {
          return new GenericResponse(ResponseStatus.InsuficcientCurrency);
        }
        if (purchaseResponse.success && purchaseResponse.okay) {
          return new GenericResponse(ResponseStatus.Success);
        }
      }
    } catch (error) {
      console.error('[API] Error purchasing chests:', error);
    }
    return new GenericResponse(ResponseStatus.Failed);
  }

  static async useBlacksmith(options: UseBlacksmithOptions): Promise<GenericResponse | UseBlacksmithResponse> {
    const request = new URL(options.server);

    if (options.count > IdleChampionsApi.MAX_BLACKSMITH) {
      throw new Error('Count limited to IdleChampionsApi.MAX_BLACKSMITH per call.');
    }

    request.searchParams.append('call', 'useServerBuff');
    request.searchParams.append('user_id', options.user_id);
    request.searchParams.append('hash', options.hash);
    request.searchParams.append('buff_id', options.contractType.toString());
    request.searchParams.append('hero_id', options.heroId);
    request.searchParams.append('num_uses', options.count.toString());
    request.searchParams.append('instance_id', options.instanceId);
    request.searchParams.append('game_instance_id', '1');
    request.searchParams.append('timestamp', '0');
    request.searchParams.append('request_id', '0');
    request.searchParams.append('language_id', IdleChampionsApi.LANGUAGE_ID);
    request.searchParams.append('network_id', IdleChampionsApi.NETWORK_ID);
    request.searchParams.append('localization_aware', 'true');

    console.log(`[API] Using blacksmith from: ${request.toString().split('hash=')[0]}hash=***`);

    try {
      const response = await fetch(request.toString(), { agent: this.httpsAgent } as any);
      if (response.ok) {
        const useServerBuffResponse: UseServerBuffResponse = await IdleChampionsApi.tryToJson(response);
        if (!useServerBuffResponse) {
          return new GenericResponse(ResponseStatus.Failed);
        }
        if (useServerBuffResponse.switch_play_server) {
          return new GenericResponse(ResponseStatus.SwitchServer, useServerBuffResponse.switch_play_server);
        }
        if (useServerBuffResponse.failure_reason && useServerBuffResponse.failure_reason.toLowerCase().includes('outdated')) {
          return new GenericResponse(ResponseStatus.OutdatedInstanceId);
        }
        if (useServerBuffResponse.success && useServerBuffResponse.okay) {
          return new UseBlacksmithResponse(useServerBuffResponse.actions);
        }
      }
    } catch (error) {
      console.error('[API] Error using blacksmith:', error);
    }
    return new GenericResponse(ResponseStatus.Failed);
  }

  static async tryToJson(response: any): Promise<any> {
    try {
      return await response.json();
    } catch (e) {
      console.error('[API] Failed to parse JSON:', e);
      return null;
    }
  }

  static isGenericResponse(response: GenericResponse | any): response is GenericResponse {
    return response instanceof GenericResponse;
  }
}

// Response classes for type safety
class GenericResponse {
  status: ResponseStatus;
  newServer?: string;

  constructor(status: ResponseStatus, newServer?: string) {
    this.status = status;
    this.newServer = newServer ? newServer + 'post.php' : undefined;
  }
}

class CodeSubmitResponse {
  codeStatus: CodeSubmitStatus;
  lootDetail?: LootDetail[];

  constructor(codeStatus: CodeSubmitStatus, lootDetail?: LootDetail[]) {
    this.codeStatus = codeStatus;
    this.lootDetail = lootDetail;
  }
}

class OpenChestResponse {
  lootDetail: LootDetailsEntity[];

  constructor(lootDetail: LootDetailsEntity[]) {
    this.lootDetail = lootDetail;
  }
}

class UseBlacksmithResponse {
  actions: BlacksmithAction[];

  constructor(actions: BlacksmithAction[]) {
    this.actions = actions;
  }
}

enum CodeSubmitStatus {
  Success,
  AlreadyRedeemed,
  InvalidParameters,
  NotValidCombo,
  Expired,
  CannotRedeem,
}

enum ResponseStatus {
  Success,
  OutdatedInstanceId,
  Failed,
  InsuficcientCurrency,
  SwitchServer,
}

enum FailureReason {
  AlreadyRedeemed = 'already_redeemed',
  SomeoneAlreadyRedeemed = 'someone_already_redeemed',
  Expired = 'expired',
  NotValidCombo = 'invalid_code_combo',
  OutdatedInstanceId = 'outdated_instance_id',
  InvalidParameters = 'invalid_parameters',
  CannotRedeem = 'cannot_redeem',
  NotEnoughCurrency = 'insufficient_currency',
}

export default IdleChampionsApi;
