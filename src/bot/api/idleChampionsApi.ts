/// <reference path="./types/player_data.d.ts" />
/// <reference path="./types/redeem_code_response.d.ts" />
/// <reference path="./types/server_definitions.d.ts" />
/// <reference path="./types/blacksmith_response.d.ts" />

import logger from '../utils/logger';
import { apiRequestLogger } from '../utils/apiRequestLogger';

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

/**
 * Every outbound call gets a timeout. Bun's fetch has no default, and
 * submitCode runs inside a serialized redeem queue -- one hung request there
 * stalls auto-redemption for every subsequent code and every user, silently.
 */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * The Idle Champions host has served an expired certificate in the past.
 * Scope that exception to this one host rather than setting
 * NODE_TLS_REJECT_UNAUTHORIZED=0, which disables validation process-wide --
 * including for the Discord gateway, exposing DISCORD_TOKEN.
 *
 * Set IDLE_CHAMPIONS_INSECURE_TLS=1 only if the certificate is actually broken;
 * verify first, since it may since have been renewed.
 */
const ALLOW_INSECURE_TLS =
  process.env.IDLE_CHAMPIONS_INSECURE_TLS === '1' ||
  process.env.IDLE_CHAMPIONS_INSECURE_TLS === 'true';

function apiFetch(url: string): Promise<Response> {
  const init: RequestInit & { tls?: { rejectUnauthorized: boolean } } = {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  };
  if (ALLOW_INSECURE_TLS) {
    init.tls = { rejectUnauthorized: false };
  }
  return fetch(url, init);
}

class IdleChampionsApi {
  private static readonly CLIENT_VERSION = '999';
  private static readonly NETWORK_ID = '21';
  private static readonly LANGUAGE_ID = '1';
  public static readonly MAX_OPEN_CHESTS = 1000;
  public static readonly MAX_BLACKSMITH = 1000;

  static async getServer(): Promise<string | undefined> {
    const request = new URL('https://master.idlechampions.com/~idledragons/post.php');

    request.searchParams.append('call', 'getPlayServerForDefinitions');
    request.searchParams.append('mobile_client_version', '999');
    request.searchParams.append('network_id', IdleChampionsApi.NETWORK_ID);
    request.searchParams.append('timestamp', '0');
    request.searchParams.append('request_id', '0');
    request.searchParams.append('localization_aware', 'true');

    try {
      const response = await apiFetch(request.toString());
      const body = await IdleChampionsApi.tryToJson(response.clone());

      apiRequestLogger.log(
        undefined,
        'getPlayServerForDefinitions',
        {
          url: request.toString(),
          method: 'GET',
        },
        {
          status: response.status,
          ok: response.ok,
          body,
        }
      );

      if (response.ok) {
        const serverDefs: ServerDefinitions = body;

        if (serverDefs && serverDefs.play_server) {
          const result = serverDefs.play_server + 'post.php';
          logger.debug(`Server: ${result}`);
          return result;
        } else {
          logger.error('No play_server in response');
        }
      } else {
        logger.error(`Failed to get server: HTTP ${response.status}`);
      }
    } catch (error) {
      logger.error('Error getting server:', error);
      apiRequestLogger.log(
        undefined,
        'getPlayServerForDefinitions',
        {
          url: request.toString(),
          method: 'GET',
        },
        {
          status: 0,
          ok: false,
          error: String(error),
        }
      );
    }
    return undefined;
  }

  static async submitCode(
    options: CodeSubmitOptions
  ): Promise<GenericResponse | CodeSubmitResponse> {
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

    logger.debug(`Submitting code to: ${request.toString().split('hash=')[0]}hash=***`);

    try {
      const response = await apiFetch(request.toString());
      const redeemResponse: RedeemCodeResponse = await IdleChampionsApi.tryToJson(response.clone());

      apiRequestLogger.log(
        options.user_id,
        'redeemcoupon',
        {
          url: request.toString(),
          method: 'POST',
          body: { code: options.code },
        },
        {
          status: response.status,
          ok: response.ok,
          body: redeemResponse,
        }
      );

      if (response.ok) {
        if (!redeemResponse) {
          return new GenericResponse(ResponseStatus.Failed);
        }
        if (redeemResponse.switch_play_server) {
          return new GenericResponse(
            ResponseStatus.SwitchServer,
            redeemResponse.switch_play_server
          );
        }

        const failureReason = redeemResponse.failure_reason
          ? String(redeemResponse.failure_reason)
          : '';

        if (failureReason) {
          const outcome = classifyFailureReason(failureReason);
          if (outcome) {
            return outcome.kind === 'code'
              ? new CodeSubmitResponse(outcome.status)
              : new GenericResponse(outcome.status);
          }
          // Unknown wire value. Logged at error (not warn) so it reaches
          // logs/error.log -- an upstream wording change would otherwise tell
          // every user that every valid code is invalid, with no visible trace.
          logger.error(
            `[REDEEM API] Unrecognized failure_reason "${failureReason}" - falling back to NotValidCombo. The API contract may have changed.`
          );
          return new CodeSubmitResponse(CodeSubmitStatus.NotValidCombo);
        }

        if (redeemResponse.success && redeemResponse.okay) {
          return new CodeSubmitResponse(CodeSubmitStatus.Success, redeemResponse?.loot_details);
        }

        logger.error('[REDEEM API] Response had neither failure_reason nor success/okay');
        return new CodeSubmitResponse(CodeSubmitStatus.NotValidCombo);
      }

      logger.error(
        `[REDEEM API] redeemcoupon returned HTTP ${response.status} ${response.statusText}`
      );
    } catch (error) {
      logger.error('Error submitting code:', error);
      apiRequestLogger.log(
        options.user_id,
        'redeemcoupon',
        {
          url: request.toString(),
          method: 'POST',
          body: { code: options.code },
        },
        {
          status: 0,
          ok: false,
          error: String(error),
        }
      );
    }
    return new GenericResponse(ResponseStatus.Failed);
  }

  static async getUserDetails(
    options: GetUserDetailsOptions
  ): Promise<GenericResponse | PlayerData> {
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
      // AbortSignal.timeout replaces a Promise.race that never cleared its timer
      // and never aborted the losing request.
      const response = await apiFetch(request.toString());

      if (response.ok) {
        const playerData: PlayerData = await IdleChampionsApi.tryToJson(response.clone());

        apiRequestLogger.log(
          options.user_id,
          'getuserdetails',
          {
            url: request.toString(),
            method: 'POST',
          },
          {
            status: response.status,
            ok: response.ok,
            body: playerData,
          }
        );

        if (playerData.switch_play_server) {
          return new GenericResponse(ResponseStatus.SwitchServer, playerData.switch_play_server);
        }
        if (playerData?.success) {
          return playerData;
        }
      } else {
        const text = await response.text();
        logger.error(`Bad response status: ${response.status}`);
        logger.error(`Response body (first 500 chars): ${text.substring(0, 500)}`);

        apiRequestLogger.log(
          options.user_id,
          'getuserdetails',
          {
            url: request.toString(),
            method: 'POST',
          },
          {
            status: response.status,
            ok: response.ok,
            body: text.substring(0, 500),
          }
        );
      }
    } catch (error) {
      logger.error('Error getting user details:', error);
      apiRequestLogger.log(
        options.user_id,
        'getuserdetails',
        {
          url: request.toString(),
          method: 'POST',
        },
        {
          status: 0,
          ok: false,
          error: String(error),
        }
      );
    }
    return new GenericResponse(ResponseStatus.Failed);
  }

  static async openChests(
    options: OpenChestsOptions
  ): Promise<GenericResponse | OpenChestResponse> {
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

    logger.debug(`Opening chests from: ${request.toString().split('hash=')[0]}hash=***`);

    try {
      const response = await apiFetch(request.toString());
      const openGenericChestResponse: OpenGenericChestResponse = await IdleChampionsApi.tryToJson(
        response.clone()
      );

      apiRequestLogger.log(
        options.user_id,
        'opengenericchest',
        {
          url: request.toString(),
          method: 'POST',
          body: { chestTypeId: options.chestTypeId, count: options.count },
        },
        {
          status: response.status,
          ok: response.ok,
          body: openGenericChestResponse,
        }
      );

      if (response.ok) {
        if (!openGenericChestResponse) {
          return new GenericResponse(ResponseStatus.Failed);
        }
        if (openGenericChestResponse.switch_play_server) {
          return new GenericResponse(
            ResponseStatus.SwitchServer,
            openGenericChestResponse.switch_play_server
          );
        }
        if (
          openGenericChestResponse.failure_reason &&
          openGenericChestResponse.failure_reason.toLowerCase().includes('outdated')
        ) {
          return new GenericResponse(ResponseStatus.OutdatedInstanceId);
        }
        if (openGenericChestResponse.success && openGenericChestResponse.loot_details) {
          return new OpenChestResponse(openGenericChestResponse.loot_details);
        }
      }
    } catch (error) {
      logger.error('Error opening chests:', error);
      apiRequestLogger.log(
        options.user_id,
        'opengenericchest',
        {
          url: request.toString(),
          method: 'POST',
          body: { chestTypeId: options.chestTypeId, count: options.count },
        },
        {
          status: 0,
          ok: false,
          error: String(error),
        }
      );
    }
    return new GenericResponse(ResponseStatus.Failed);
  }


  static async useBlacksmith(
    options: UseBlacksmithOptions
  ): Promise<GenericResponse | UseBlacksmithResponse> {
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

    logger.debug(`Using blacksmith from: ${request.toString().split('hash=')[0]}hash=***`);

    try {
      const response = await apiFetch(request.toString());
      const useServerBuffResponse: UseServerBuffResponse = await IdleChampionsApi.tryToJson(
        response.clone()
      );

      apiRequestLogger.log(
        options.user_id,
        'useServerBuff',
        {
          url: request.toString(),
          method: 'POST',
          body: {
            contractType: options.contractType,
            heroId: options.heroId,
            count: options.count,
          },
        },
        {
          status: response.status,
          ok: response.ok,
          body: useServerBuffResponse,
        }
      );

      if (response.ok) {
        if (!useServerBuffResponse) {
          return new GenericResponse(ResponseStatus.Failed);
        }
        if (useServerBuffResponse.switch_play_server) {
          return new GenericResponse(
            ResponseStatus.SwitchServer,
            useServerBuffResponse.switch_play_server
          );
        }
        if (
          useServerBuffResponse.failure_reason &&
          useServerBuffResponse.failure_reason.toLowerCase().includes('outdated')
        ) {
          return new GenericResponse(ResponseStatus.OutdatedInstanceId);
        }
        if (useServerBuffResponse.success && useServerBuffResponse.okay) {
          return new UseBlacksmithResponse(useServerBuffResponse.actions);
        }
      }
    } catch (error) {
      logger.error('Error using blacksmith:', error);
      apiRequestLogger.log(
        options.user_id,
        'useServerBuff',
        {
          url: request.toString(),
          method: 'POST',
          body: {
            contractType: options.contractType,
            heroId: options.heroId,
            count: options.count,
          },
        },
        {
          status: 0,
          ok: false,
          error: String(error),
        }
      );
    }
    return new GenericResponse(ResponseStatus.Failed);
  }

  static async tryToJson(response: any): Promise<any> {
    try {
      return await response.json();
    } catch (e) {
      logger.error('Failed to parse JSON:', e);
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

export enum CodeSubmitStatus {
  Success,
  AlreadyRedeemed,
  InvalidParameters,
  NotValidCombo,
  Expired,
  CannotRedeem,
}

export enum ResponseStatus {
  Success,
  OutdatedInstanceId,
  Failed,
  InsuficcientCurrency,
  SwitchServer,
}



type FailureOutcome =
  | { kind: 'code'; status: CodeSubmitStatus }
  | { kind: 'generic'; status: ResponseStatus };

/**
 * Exact failure_reason -> outcome mapping.
 *
 * This replaces an ordered chain of substring tests in which
 * `includes('invalid')` shadowed the later `includes('parameter')` test and
 * `'can_not_redeem_combination'` never matched `includes('cannot')`, making
 * InvalidParameters and CannotRedeem unreachable -- a credentials problem was
 * reported to the user as "Not a Valid Code".
 *
 * Two sets of wire values were in the tree: the generated declaration in
 * api/types/redeem_code_response.d.ts and a module-local enum with different
 * strings that shadowed it. Both are accepted here rather than guessing which
 * the live API currently emits. Keys are lowercased at lookup.
 */
const FAILURE_OUTCOMES: Readonly<Record<string, FailureOutcome>> = {
  // from api/types/redeem_code_response.d.ts (generated from real responses)
  'outdated instance id': { kind: 'generic', status: ResponseStatus.OutdatedInstanceId },
  'you_already_redeemed_combination': { kind: 'code', status: CodeSubmitStatus.AlreadyRedeemed },
  'someone_already_redeemed_combination': { kind: 'code', status: CodeSubmitStatus.AlreadyRedeemed },
  'invalid or incomplete parameters': { kind: 'code', status: CodeSubmitStatus.InvalidParameters },
  'not_valid_combination': { kind: 'code', status: CodeSubmitStatus.NotValidCombo },
  'offer_has_expired': { kind: 'code', status: CodeSubmitStatus.Expired },
  'not enough currency': { kind: 'generic', status: ResponseStatus.InsuficcientCurrency },
  'can_not_redeem_combination': { kind: 'code', status: CodeSubmitStatus.CannotRedeem },
  // from the former module-local enum
  'already_redeemed': { kind: 'code', status: CodeSubmitStatus.AlreadyRedeemed },
  'someone_already_redeemed': { kind: 'code', status: CodeSubmitStatus.AlreadyRedeemed },
  'expired': { kind: 'code', status: CodeSubmitStatus.Expired },
  'invalid_code_combo': { kind: 'code', status: CodeSubmitStatus.NotValidCombo },
  'outdated_instance_id': { kind: 'generic', status: ResponseStatus.OutdatedInstanceId },
  'invalid_parameters': { kind: 'code', status: CodeSubmitStatus.InvalidParameters },
  'cannot_redeem': { kind: 'code', status: CodeSubmitStatus.CannotRedeem },
  'insufficient_currency': { kind: 'generic', status: ResponseStatus.InsuficcientCurrency },
};

export function classifyFailureReason(reason: string): FailureOutcome | undefined {
  return FAILURE_OUTCOMES[reason.trim().toLowerCase()];
}

export default IdleChampionsApi;
