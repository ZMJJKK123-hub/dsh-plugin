import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
//#region lib/types/index.js
/**
* Remote exposure of the `ctx.automations` capability seam as the
* `automationsRemote` Typert Remote namespace for the Web Client. Every
* answer is a discriminated result (`ok` carries the wire view, `false`
* carries the panel-renderable error); a Remote call never rejects.
*
* @module @dsh-custom/dsh-automations-remote
*/
var __runInitializers = function(thisArg, initializers, value) {
	var useValue = arguments.length > 2;
	for (var i = 0; i < initializers.length; i++) value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
	return useValue ? value : void 0;
};
var __esDecorate = function(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
	function accept(f) {
		if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected");
		return f;
	}
	var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
	var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
	var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
	var _, done = false;
	for (var i = decorators.length - 1; i >= 0; i--) {
		var context = {};
		for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
		for (var p in contextIn.access) context.access[p] = contextIn.access[p];
		context.addInitializer = function(f) {
			if (done) throw new TypeError("Cannot add initializers after decoration has completed");
			extraInitializers.push(accept(f || null));
		};
		var result = (0, decorators[i])(kind === "accessor" ? {
			get: descriptor.get,
			set: descriptor.set
		} : descriptor[key], context);
		if (kind === "accessor") {
			if (result === void 0) continue;
			if (result === null || typeof result !== "object") throw new TypeError("Object expected");
			if (_ = accept(result.get)) descriptor.get = _;
			if (_ = accept(result.set)) descriptor.set = _;
			if (_ = accept(result.init)) initializers.unshift(_);
		} else if (_ = accept(result)) if (kind === "field") initializers.unshift(_);
		else descriptor[key] = _;
	}
	if (target) Object.defineProperty(target, contextIn.name, descriptor);
	done = true;
};
/**
* Run one seam call and project it onto the wire result; any throw becomes
* the honest failure the panel renders.
* @param body - one seam call returning the wire view.
*/
async function answer(body) {
	try {
		return {
			ok: true,
			value: await body()
		};
	} catch (error) {
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}
/** Project one record onto its wire view. */
function viewOf(record) {
	return {
		id: record.id,
		title: record.title,
		workspacePath: record.workspacePath,
		prompt: record.prompt,
		cron: record.cron,
		enabled: record.enabled,
		nextRunAt: record.nextRunAt,
		lastRunAt: record.lastRunAt,
		...record.lastOutcome !== void 0 ? { lastOutcome: record.lastOutcome } : {},
		...record.lastError !== void 0 ? { lastError: record.lastError } : {}
	};
}
let AutomationsRemoteService = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _list_decorators;
	let _create_decorators;
	let _update_decorators;
	let _deleteAutomation_decorators;
	let _runNow_decorators;
	return class AutomationsRemoteService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_list_decorators = [Remote("list")];
			_create_decorators = [Remote("create")];
			_update_decorators = [Remote("update")];
			_deleteAutomation_decorators = [Remote("deleteAutomation")];
			_runNow_decorators = [Remote("runNow")];
			__esDecorate(this, null, _list_decorators, {
				kind: "method",
				name: "list",
				static: false,
				private: false,
				access: {
					has: (obj) => "list" in obj,
					get: (obj) => obj.list
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _create_decorators, {
				kind: "method",
				name: "create",
				static: false,
				private: false,
				access: {
					has: (obj) => "create" in obj,
					get: (obj) => obj.create
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _update_decorators, {
				kind: "method",
				name: "update",
				static: false,
				private: false,
				access: {
					has: (obj) => "update" in obj,
					get: (obj) => obj.update
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _deleteAutomation_decorators, {
				kind: "method",
				name: "deleteAutomation",
				static: false,
				private: false,
				access: {
					has: (obj) => "deleteAutomation" in obj,
					get: (obj) => obj.deleteAutomation
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _runNow_decorators, {
				kind: "method",
				name: "runNow",
				static: false,
				private: false,
				access: {
					has: (obj) => "runNow" in obj,
					get: (obj) => obj.runNow
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			if (_metadata) Object.defineProperty(this, Symbol.metadata, {
				enumerable: true,
				configurable: true,
				writable: true,
				value: _metadata
			});
		}
		static inject = ["automations"];
		constructor(ctx) {
			super(ctx, "automationsRemote");
			__runInitializers(this, _instanceExtraInitializers);
		}
		/**
		* `automationsRemote.list`: every automation, in creation order.
		* @returns the list view, or the failure the panel renders.
		*/
		async list() {
			return await answer(async () => {
				return { automations: (await this.ctx.automations.list()).map(viewOf) };
			});
		}
		/**
		* `automationsRemote.create`: one automation; the first run time is computed.
		* @param request - title, absolute workspace, prompt, cron expression.
		* @returns the created view, or the failure the panel renders.
		*/
		async create(request) {
			return await answer(async () => viewOf(await this.ctx.automations.create(request)));
		}
		/**
		* `automationsRemote.update`: editable fields; a cron change recomputes the schedule.
		* @param request - the id and the fields to replace.
		* @returns the updated view, or the failure the panel renders.
		*/
		async update(request) {
			return await answer(async () => {
				const { id, ...fields } = request;
				return viewOf(await this.ctx.automations.update(id, fields));
			});
		}
		/**
		* `automationsRemote.deleteAutomation`: delete one automation.
		* @param request - the id to remove.
		* @returns an empty value, or the failure the panel renders.
		*/
		async deleteAutomation(request) {
			return await answer(async () => {
				await this.ctx.automations.remove(request.id);
				return null;
			});
		}
		/**
		* `automationsRemote.runNow`: fire one automation immediately, outside its schedule.
		* @param request - the id to fire.
		* @returns an empty value, or the failure the panel renders.
		*/
		async runNow(request) {
			return await answer(async () => {
				await this.ctx.automations.runNow(request.id);
				return null;
			});
		}
	};
})();
//#endregion
export { AutomationsRemoteService, AutomationsRemoteService as default };
