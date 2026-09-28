/**
 * Remote exposure of the `ctx.automations` capability seam as the
 * `automationsRemote` Typert Remote namespace for the Web Client. Every
 * answer is a discriminated result (`ok` carries the wire view, `false`
 * carries the panel-renderable error); a Remote call never rejects.
 *
 * @module @dsh-custom/dsh-automations-remote
 */
import type { Context } from '@deepseek-ai/cordis';
import { TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol';
import type { AutomationCreateRequest, AutomationIdRequest, AutomationListView, AutomationUpdateRequest, AutomationView, AutomationsRemoteResult } from './types.ts';
export type { AutomationCreateRequest, AutomationIdRequest, AutomationListView, AutomationUpdateRequest, AutomationView, AutomationsRemoteResult, } from './types.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        automationsRemote: AutomationsRemoteService;
    }
}
export declare class AutomationsRemoteService extends TypertRemoteService {
    static inject: string[];
    constructor(ctx: Context);
    /**
     * `automationsRemote.list`: every automation, in creation order.
     * @returns the list view, or the failure the panel renders.
     */
    list(): Promise<AutomationsRemoteResult<AutomationListView>>;
    /**
     * `automationsRemote.create`: one automation; the first run time is computed.
     * @param request - title, absolute workspace, prompt, cron expression.
     * @returns the created view, or the failure the panel renders.
     */
    create(request: AutomationCreateRequest): Promise<AutomationsRemoteResult<AutomationView>>;
    /**
     * `automationsRemote.update`: editable fields; a cron change recomputes the schedule.
     * @param request - the id and the fields to replace.
     * @returns the updated view, or the failure the panel renders.
     */
    update(request: AutomationUpdateRequest): Promise<AutomationsRemoteResult<AutomationView>>;
    /**
     * `automationsRemote.deleteAutomation`: delete one automation.
     * @param request - the id to remove.
     * @returns an empty value, or the failure the panel renders.
     */
    deleteAutomation(request: AutomationIdRequest): Promise<AutomationsRemoteResult<null>>;
    /**
     * `automationsRemote.runNow`: fire one automation immediately, outside its schedule.
     * @param request - the id to fire.
     * @returns an empty value, or the failure the panel renders.
     */
    runNow(request: AutomationIdRequest): Promise<AutomationsRemoteResult<null>>;
}
export default AutomationsRemoteService;
//# sourceMappingURL=index.d.ts.map