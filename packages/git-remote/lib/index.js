import { BlockAssembler, createUserMessage } from "@deepseek-ai/dsh-llm";
import { deadline } from "@deepseek-ai/dsh-timeout";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { GitError } from "@dsh-custom/dsh-git";
//#region ../../../vendor/cosmokit/src/misc.ts
/** Return true when a value is `null` or `undefined`. */
function isNullable(value) {
	return value === null || value === void 0;
}
/** Return true for non-array object values. */
function isPlainObject(data) {
	return data && typeof data === "object" && !Array.isArray(data);
}
/** Filter object entries and return a new object. */
function filterKeys(object, filter) {
	return Object.fromEntries(Object.entries(object).filter(([key, value]) => filter(key, value)));
}
/** Map object values while preserving the original key set. */
function mapValues(object, transform) {
	return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, transform(value, key)]));
}
/** Pick selected keys from an object, optionally including `undefined` values. */
function pick(source, keys, forced) {
	if (!keys) return { ...source };
	const result = {};
	for (const key of keys) if (forced || source[key] !== void 0) result[key] = source[key];
	return result;
}
//#endregion
//#region ../../../vendor/cosmokit/src/types.ts
/** Test values using `instanceof` with a `toStringTag` fallback. */
function is(type, value) {
	if (arguments.length === 1) return (value) => is(type, value);
	return type in globalThis && value instanceof globalThis[type] || Object.prototype.toString.call(value).slice(8, -1) === type;
}
function isArrayBufferLike(value) {
	return is("ArrayBuffer", value) || is("SharedArrayBuffer", value);
}
function isArrayBufferSource(value) {
	return isArrayBufferLike(value) || ArrayBuffer.isView(value);
}
let Binary;
(function(_Binary) {
	_Binary.is = isArrayBufferLike;
	_Binary.isSource = isArrayBufferSource;
	function fromSource(source) {
		if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
		else return source;
	}
	_Binary.fromSource = fromSource;
	function toBase64(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("base64");
		let binary = "";
		const bytes = new Uint8Array(source);
		for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
		return btoa(binary);
	}
	_Binary.toBase64 = toBase64;
	function fromBase64(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "base64"));
		return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
	}
	_Binary.fromBase64 = fromBase64;
	function toHex(source) {
		source = fromSource(source);
		if (typeof Buffer !== "undefined") return Buffer.from(source).toString("hex");
		return Array.from(new Uint8Array(source), (byte) => byte.toString(16).padStart(2, "0")).join("");
	}
	_Binary.toHex = toHex;
	function fromHex(source) {
		if (typeof Buffer !== "undefined") return fromSource(Buffer.from(source, "hex"));
		const hex = source.length % 2 === 0 ? source : source.slice(0, source.length - 1);
		const buffer = [];
		for (let i = 0; i < hex.length; i += 2) buffer.push(parseInt(`${hex[i]}${hex[i + 1]}`, 16));
		return Uint8Array.from(buffer).buffer;
	}
	_Binary.fromHex = fromHex;
})(Binary || (Binary = {}));
Binary.fromBase64;
Binary.toBase64;
Binary.fromHex;
Binary.toHex;
/** Deep-clone common JavaScript values while preserving prototypes and cycles. */
function clone(source, refs = /* @__PURE__ */ new Map()) {
	if (!source || typeof source !== "object") return source;
	if (is("Date", source)) return new Date(source.valueOf());
	if (is("RegExp", source)) return new RegExp(source.source, source.flags);
	if (isArrayBufferLike(source)) return source.slice(0);
	if (ArrayBuffer.isView(source)) return source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
	const cached = refs.get(source);
	if (cached) return cached;
	if (Array.isArray(source)) {
		const result = [];
		refs.set(source, result);
		source.forEach((value, index) => {
			result[index] = Reflect.apply(clone, null, [value, refs]);
		});
		return result;
	}
	const result = Object.create(Object.getPrototypeOf(source));
	refs.set(source, result);
	for (const key of Reflect.ownKeys(source)) {
		const descriptor = { ...Reflect.getOwnPropertyDescriptor(source, key) };
		if ("value" in descriptor) descriptor.value = Reflect.apply(clone, null, [descriptor.value, refs]);
		Reflect.defineProperty(result, key, descriptor);
	}
	return result;
}
/** Deeply compare arrays, dates, regexps, buffers, and plain object fields. */
function deepEqual(a, b, strict) {
	if (a === b) return true;
	if (!strict && isNullable(a) && isNullable(b)) return true;
	if (typeof a !== typeof b) return false;
	if (typeof a !== "object") return false;
	if (!a || !b) return false;
	function check(test, then) {
		return test(a) ? test(b) ? then(a, b) : false : test(b) ? false : void 0;
	}
	return check(Array.isArray, (a, b) => a.length === b.length && a.every((item, index) => deepEqual(item, b[index]))) ?? check(is("Date"), (a, b) => a.valueOf() === b.valueOf()) ?? check(is("RegExp"), (a, b) => a.source === b.source && a.flags === b.flags) ?? check(isArrayBufferLike, (a, b) => {
		if (a.byteLength !== b.byteLength) return false;
		const viewA = new Uint8Array(a);
		const viewB = new Uint8Array(b);
		for (let i = 0; i < viewA.length; i++) if (viewA[i] !== viewB[i]) return false;
		return true;
	}) ?? Object.keys({
		...a,
		...b
	}).every((key) => deepEqual(a[key], b[key], strict));
}
//#endregion
//#region ../../../vendor/cosmokit/src/time.ts
let Time;
(function(_Time) {
	_Time.millisecond = 1;
	const second = _Time.second = 1e3;
	const minute = _Time.minute = second * 60;
	const hour = _Time.hour = minute * 60;
	const day = _Time.day = hour * 24;
	const week = _Time.week = day * 7;
	let timezoneOffset = (/* @__PURE__ */ new Date()).getTimezoneOffset();
	function setTimezoneOffset(offset) {
		timezoneOffset = offset;
	}
	_Time.setTimezoneOffset = setTimezoneOffset;
	function getTimezoneOffset() {
		return timezoneOffset;
	}
	_Time.getTimezoneOffset = getTimezoneOffset;
	function getDateNumber(date = /* @__PURE__ */ new Date(), offset) {
		if (typeof date === "number") date = new Date(date);
		if (offset === void 0) offset = timezoneOffset;
		return Math.floor((date.valueOf() / minute - offset) / 1440);
	}
	_Time.getDateNumber = getDateNumber;
	function fromDateNumber(value, offset) {
		const date = new Date(value * day);
		if (offset === void 0) offset = timezoneOffset;
		return new Date(+date + offset * minute);
	}
	_Time.fromDateNumber = fromDateNumber;
	const numeric = /\d+(?:\.\d+)?/.source;
	const timeRegExp = new RegExp(`^${[
		"w(?:eek(?:s)?)?",
		"d(?:ay(?:s)?)?",
		"h(?:our(?:s)?)?",
		"m(?:in(?:ute)?(?:s)?)?",
		"s(?:ec(?:ond)?(?:s)?)?"
	].map((unit) => `(${numeric}${unit})?`).join("")}$`);
	function parseTime(source) {
		const capture = timeRegExp.exec(source);
		if (!capture) return 0;
		return (parseFloat(capture[1]) * week || 0) + (parseFloat(capture[2]) * day || 0) + (parseFloat(capture[3]) * hour || 0) + (parseFloat(capture[4]) * minute || 0) + (parseFloat(capture[5]) * second || 0);
	}
	_Time.parseTime = parseTime;
	function parseDate(date) {
		const parsed = parseTime(date);
		if (parsed) date = Date.now() + parsed;
		else if (/^\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).toLocaleDateString()}-${date}`;
		else if (/^\d{1,2}-\d{1,2}-\d{1,2}(:\d{1,2}){1,2}$/.test(date)) date = `${(/* @__PURE__ */ new Date()).getFullYear()}-${date}`;
		return date ? new Date(date) : /* @__PURE__ */ new Date();
	}
	_Time.parseDate = parseDate;
	function format(ms) {
		const abs = Math.abs(ms);
		if (abs >= day - hour / 2) return Math.round(ms / day) + "d";
		else if (abs >= hour - minute / 2) return Math.round(ms / hour) + "h";
		else if (abs >= minute - second / 2) return Math.round(ms / minute) + "m";
		else if (abs >= second) return Math.round(ms / second) + "s";
		return ms + "ms";
	}
	_Time.format = format;
	function toDigits(source, length = 2) {
		return source.toString().padStart(length, "0");
	}
	_Time.toDigits = toDigits;
	function template(template, time = /* @__PURE__ */ new Date()) {
		return template.replace("yyyy", time.getFullYear().toString()).replace("yy", time.getFullYear().toString().slice(2)).replace("MM", toDigits(time.getMonth() + 1)).replace("dd", toDigits(time.getDate())).replace("hh", toDigits(time.getHours())).replace("mm", toDigits(time.getMinutes())).replace("ss", toDigits(time.getSeconds())).replace("SSS", toDigits(time.getMilliseconds(), 3));
	}
	_Time.template = template;
})(Time || (Time = {}));
//#endregion
//#region ../../../vendor/schemastery/src/index.ts
const kSchema = Symbol.for("schemastery");
const kValidationError = Symbol.for("ValidationError");
globalThis.__schemastery_index__ ??= 0;
globalThis.__schemastery_refs__ = void 0;
var ValidationError = class extends TypeError {
	options;
	name = "ValidationError";
	constructor(message, options) {
		let prefix = "$";
		for (const segment of options.path || []) if (typeof segment === "string") prefix += "." + segment;
		else if (typeof segment === "number") prefix += "[" + segment + "]";
		else if (typeof segment === "symbol") prefix += `[Symbol(${segment.toString()})]`;
		if (prefix.startsWith(".")) prefix = prefix.slice(1);
		super((prefix === "$" ? "" : `${prefix} `) + message);
		this.options = options;
	}
	static is(error) {
		return !!error?.[kValidationError];
	}
};
Object.defineProperty(ValidationError.prototype, kValidationError, { value: true });
const Schema = function(options) {
	const schema = function(data, options = {}) {
		return Schema.resolve(data, schema, options)[0];
	};
	if (options.refs) {
		const refs = mapValues(options.refs, (options) => new Schema(options));
		const getRef = (uid) => refs[uid];
		for (const key in refs) {
			const options = refs[key];
			options.sKey = getRef(options.sKey);
			options.inner = getRef(options.inner);
			options.list = options.list && options.list.map(getRef);
			options.dict = options.dict && mapValues(options.dict, getRef);
		}
		return refs[options.uid];
	}
	Object.assign(schema, options);
	if (typeof schema.callback === "string") try {
		schema.callback = new Function("return " + schema.callback)();
	} catch {}
	Object.defineProperty(schema, "uid", { value: globalThis.__schemastery_index__++ });
	Object.setPrototypeOf(schema, Schema.prototype);
	schema.meta ||= {};
	schema.toString = schema.toString.bind(schema);
	return schema;
};
Schema.prototype = Object.create(Function.prototype);
Schema.prototype[kSchema] = true;
Object.defineProperty(Schema.prototype, "~standard", { get() {
	return {
		version: 1,
		vendor: "schemastery",
		validate: (value) => {
			try {
				return { value: Schema.resolve(value, this, {})[0] };
			} catch (error) {
				if (ValidationError.is(error)) return { issues: [{
					message: error.message,
					path: error.options.path
				}] };
				throw error;
			}
		}
	};
} });
Schema.ValidationError = ValidationError;
Schema.prototype.toJSON = function toJSON() {
	if (globalThis.__schemastery_refs__) {
		globalThis.__schemastery_refs__[this.uid] ??= JSON.parse(JSON.stringify({ ...this }));
		return this.uid;
	}
	globalThis.__schemastery_refs__ = { [this.uid]: { ...this } };
	globalThis.__schemastery_refs__[this.uid] = JSON.parse(JSON.stringify({ ...this }));
	const result = {
		uid: this.uid,
		refs: globalThis.__schemastery_refs__
	};
	globalThis.__schemastery_refs__ = void 0;
	return result;
};
Schema.prototype.set = function set(key, value) {
	this.dict[key] = value;
	return this;
};
Schema.prototype.push = function push(value) {
	this.list.push(value);
	return this;
};
function mergeDesc(original, messages) {
	const result = typeof original === "string" ? { "": original } : { ...original };
	for (const locale in messages) {
		const value = messages[locale];
		if (value?.$description || value?.$desc) result[locale] = value.$description || value.$desc;
		else if (typeof value === "string") result[locale] = value;
	}
	return result;
}
function getInner(value) {
	return value?.$value ?? value?.$inner;
}
function extractKeys(data) {
	return filterKeys(data ?? {}, (key) => !key.startsWith("$"));
}
Schema.prototype.i18n = function i18n(messages) {
	const schema = Schema(this);
	const desc = mergeDesc(schema.meta.description, messages);
	if (Object.keys(desc).length) schema.meta.description = desc;
	if (schema.dict) schema.dict = mapValues(schema.dict, (inner, key) => {
		return inner.i18n(mapValues(messages, (data) => getInner(data)?.[key] ?? data?.[key]));
	});
	if (schema.list) schema.list = schema.list.map((inner, index) => {
		return inner.i18n(mapValues(messages, (data = {}) => {
			if (Array.isArray(getInner(data))) return getInner(data)[index];
			if (Array.isArray(data)) return data[index];
			return extractKeys(data);
		}));
	});
	if (schema.inner) schema.inner = schema.inner.i18n(mapValues(messages, (data) => {
		if (getInner(data)) return getInner(data);
		return extractKeys(data);
	}));
	if (schema.sKey) schema.sKey = schema.sKey.i18n(mapValues(messages, (data) => data?.$key));
	return schema;
};
Schema.prototype.extra = function extra(key, value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
};
for (const key of [
	"required",
	"disabled",
	"collapse",
	"hidden",
	"loose"
]) Object.assign(Schema.prototype, { [key](value = true) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
Schema.prototype.deprecated = function deprecated() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "deprecated",
		type: "danger"
	});
	return schema;
};
Schema.prototype.experimental = function experimental() {
	const schema = Schema(this);
	schema.meta.badges ||= [];
	schema.meta.badges.push({
		text: "experimental",
		type: "warning"
	});
	return schema;
};
Schema.prototype.pattern = function pattern(regexp) {
	const schema = Schema(this);
	const pattern = pick(regexp, ["source", "flags"]);
	schema.meta = {
		...schema.meta,
		pattern
	};
	return schema;
};
Schema.prototype.simplify = function simplify(value) {
	if (deepEqual(value, this.meta.default, this.type === "dict")) return null;
	if (isNullable(value)) return value;
	if (this.type === "object" || this.type === "dict") {
		const result = {};
		for (const key in value) {
			const item = (this.type === "object" ? this.dict[key] : this.inner)?.simplify(value[key]);
			if (this.type === "dict" || !isNullable(item)) result[key] = item;
		}
		if (deepEqual(result, this.meta.default, this.type === "dict")) return null;
		return result;
	} else if (this.type === "array" || this.type === "tuple") {
		const result = [];
		value.forEach((value, index) => {
			const schema = this.type === "array" ? this.inner : this.list[index];
			const item = schema ? schema.simplify(value) : value;
			result.push(item);
		});
		return result;
	} else if (this.type === "intersect") {
		const result = {};
		for (const item of this.list) Object.assign(result, item.simplify(value));
		return result;
	} else if (this.type === "union") for (const schema of this.list) try {
		Schema.resolve(value, schema, {});
		return schema.simplify(value);
	} catch {}
	return value;
};
Schema.prototype.toString = function toString(inline) {
	return formatters[this.type]?.(this, inline) ?? `Schema<${this.type}>`;
};
Schema.prototype.role = function role(role, extra) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		role,
		extra
	};
	return schema;
};
for (const key of [
	"default",
	"link",
	"comment",
	"description",
	"max",
	"min",
	"step"
]) Object.assign(Schema.prototype, { [key](value) {
	const schema = Schema(this);
	schema.meta = {
		...schema.meta,
		[key]: value
	};
	return schema;
} });
const resolvers = {};
Schema.extend = function extend(type, resolve) {
	resolvers[type] = resolve;
};
Schema.resolve = function resolve(data, schema, options = {}, strict = false) {
	if (!schema) return [data];
	if (options.ignore?.(data, schema)) return [data];
	if (isNullable(data) && schema.type !== "lazy") {
		if (schema.meta.required) throw new ValidationError(`missing required value`, options);
		let current = schema;
		let fallback = schema.meta.default;
		while (current?.type === "intersect" && isNullable(fallback)) {
			current = current.list[0];
			fallback = current?.meta.default;
		}
		if (isNullable(fallback)) return [data];
		data = clone(fallback);
	}
	const callback = resolvers[schema.type];
	if (!callback) throw new ValidationError(`unsupported type "${schema.type}"`, options);
	try {
		return callback(data, schema, options, strict);
	} catch (error) {
		if (!schema.meta.loose) throw error;
		return [schema.meta.default];
	}
};
Schema.from = function from(source) {
	if (isNullable(source)) return Schema.any();
	else if ([
		"string",
		"number",
		"boolean"
	].includes(typeof source)) return Schema.const(source).required();
	else if (source[kSchema]) return source;
	else if (typeof source === "function") switch (source) {
		case String: return Schema.string().required();
		case Number: return Schema.number().required();
		case Boolean: return Schema.boolean().required();
		case Function: return Schema.function().required();
		default: return Schema.is(source).required();
	}
	else throw new TypeError(`cannot infer schema from ${source}`);
};
Schema.lazy = function lazy(builder) {
	const toJSON = () => {
		if (!schema.inner[kSchema]) {
			schema.inner = schema.builder();
			schema.inner.meta = {
				...schema.meta,
				...schema.inner.meta
			};
		}
		return schema.inner.toJSON();
	};
	const schema = new Schema({
		type: "lazy",
		builder,
		inner: { toJSON }
	});
	return schema;
};
Schema.natural = function natural() {
	return Schema.number().step(1).min(0);
};
Schema.percent = function percent() {
	return Schema.number().step(.01).min(0).max(1).role("slider");
};
Schema.date = function date() {
	return Schema.union([Schema.is(Date), Schema.transform(Schema.string().role("datetime"), (value, options) => {
		const date = new Date(value);
		if (isNaN(+date)) throw new ValidationError(`invalid date "${value}"`, options);
		return date;
	}, true)]);
};
Schema.regExp = function regExp(flag = "") {
	return Schema.union([Schema.is(RegExp), Schema.transform(Schema.string().role("regexp", { flag }), (value, options) => {
		try {
			return new RegExp(value, flag);
		} catch (e) {
			throw new ValidationError(e.message, options);
		}
	}, true)]);
};
Schema.arrayBuffer = function arrayBuffer(encoding) {
	return Schema.union([
		Schema.is(ArrayBuffer),
		Schema.is(SharedArrayBuffer),
		Schema.transform(Schema.any(), (value, options) => {
			if (Binary.isSource(value)) return Binary.fromSource(value);
			throw new ValidationError(`expected ArrayBufferSource but got ${value}`, options);
		}, true),
		...encoding ? [Schema.transform(Schema.string(), (value, options) => {
			try {
				return encoding === "base64" ? Binary.fromBase64(value) : Binary.fromHex(value);
			} catch (e) {
				throw new ValidationError(e.message, options);
			}
		}, true)] : []
	]);
};
Schema.extend("lazy", (data, schema, options, strict) => {
	if (!schema.inner[kSchema]) {
		schema.inner = schema.builder();
		schema.inner.meta = {
			...schema.meta,
			...schema.inner.meta
		};
	}
	return Schema.resolve(data, schema.inner, options, strict);
});
Schema.extend("any", (data) => {
	return [data];
});
Schema.extend("never", (data, _, options) => {
	throw new ValidationError(`expected nullable but got ${data}`, options);
});
Schema.extend("const", (data, { value }, options) => {
	if (deepEqual(data, value)) return [value];
	throw new ValidationError(`expected ${value} but got ${data}`, options);
});
function checkWithinRange(data, meta, description, options, skipMin = false) {
	const { max = Infinity, min = -Infinity } = meta;
	if (data > max) throw new ValidationError(`expected ${description} <= ${max} but got ${data}`, options);
	if (data < min && !skipMin) throw new ValidationError(`expected ${description} >= ${min} but got ${data}`, options);
}
Schema.extend("string", (data, { meta }, options) => {
	if (typeof data !== "string") throw new ValidationError(`expected string but got ${data}`, options);
	if (meta.pattern) {
		const regexp = new RegExp(meta.pattern.source, meta.pattern.flags);
		if (!regexp.test(data)) throw new ValidationError(`expect string to match regexp ${regexp}`, options);
	}
	checkWithinRange(data.length, meta, "string length", options);
	return [data];
});
function decimalShift(data, digits) {
	const str = data.toString();
	if (str.includes("e")) return data * Math.pow(10, digits);
	const index = str.indexOf(".");
	if (index === -1) return data * Math.pow(10, digits);
	const frac = str.slice(index + 1);
	const integer = str.slice(0, index);
	if (frac.length <= digits) return +(integer + frac.padEnd(digits, "0"));
	return +(integer + frac.slice(0, digits) + "." + frac.slice(digits));
}
function isMultipleOf(data, min, step) {
	step = Math.abs(step);
	if (!/^\d+\.\d+$/.test(step.toString())) return (data - min) % step === 0;
	const index = step.toString().indexOf(".");
	const digits = step.toString().slice(index + 1).length;
	return Math.abs(decimalShift(data, digits) - decimalShift(min, digits)) % decimalShift(step, digits) === 0;
}
Schema.extend("number", (data, { meta }, options) => {
	if (typeof data !== "number") throw new ValidationError(`expected number but got ${data}`, options);
	checkWithinRange(data, meta, "number", options);
	const { step } = meta;
	if (step && !isMultipleOf(data, meta.min ?? 0, step)) throw new ValidationError(`expected number multiple of ${step} but got ${data}`, options);
	return [data];
});
Schema.extend("boolean", (data, _, options) => {
	if (typeof data === "boolean") return [data];
	throw new ValidationError(`expected boolean but got ${data}`, options);
});
Schema.extend("bitset", (data, { bits, meta }, options) => {
	let value = 0, keys = [];
	if (typeof data === "number") {
		value = data;
		for (const key in bits) if (data & bits[key]) keys.push(key);
	} else if (Array.isArray(data)) {
		keys = data;
		for (const key of keys) {
			if (typeof key !== "string") throw new ValidationError(`expected string but got ${key}`, options);
			if (key in bits) value |= bits[key];
		}
	} else throw new ValidationError(`expected number or array but got ${data}`, options);
	if (value === meta.default) return [value];
	return [value, keys];
});
Schema.extend("function", (data, _, options) => {
	if (typeof data === "function") return [data];
	throw new ValidationError(`expected function but got ${data}`, options);
});
Schema.extend("is", (data, { constructor }, options) => {
	if (typeof constructor === "function") {
		if (data instanceof constructor) return [data];
		throw new ValidationError(`expected ${constructor.name} but got ${data}`, options);
	} else {
		if (isNullable(data)) throw new ValidationError(`expected ${constructor} but got ${data}`, options);
		let prototype = Object.getPrototypeOf(data);
		while (prototype) {
			if (prototype.constructor?.name === constructor) return [data];
			prototype = Object.getPrototypeOf(prototype);
		}
		throw new ValidationError(`expected ${constructor} but got ${data}`, options);
	}
});
function property(data, key, schema, options) {
	try {
		const [value, adapted] = Schema.resolve(data[key], schema, {
			...options,
			path: [...options.path || [], key]
		});
		if (adapted !== void 0) data[key] = adapted;
		return value;
	} catch (e) {
		if (!options?.autofix) throw e;
		delete data[key];
		return schema.meta.default;
	}
}
Schema.extend("array", (data, { inner, meta }, options) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	checkWithinRange(data.length, meta, "array length", options, !isNullable(inner.meta.default));
	return [data.map((_, index) => property(data, index, inner, options))];
});
Schema.extend("dict", (data, { inner, sKey }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in data) {
		let rKey;
		try {
			rKey = Schema.resolve(key, sKey, options)[0];
		} catch (error) {
			if (strict) continue;
			throw error;
		}
		result[rKey] = property(data, key, inner, options);
		data[rKey] = data[key];
		if (key !== rKey) delete data[key];
	}
	return [result];
});
Schema.extend("tuple", (data, { list }, options, strict) => {
	if (!Array.isArray(data)) throw new ValidationError(`expected array but got ${data}`, options);
	const result = list.map((inner, index) => property(data, index, inner, options));
	if (strict) return [result];
	result.push(...data.slice(list.length));
	return [result];
});
function merge(result, data) {
	for (const key in data) {
		if (key in result) continue;
		result[key] = data[key];
	}
}
Schema.extend("object", (data, { dict }, options, strict) => {
	if (!isPlainObject(data)) throw new ValidationError(`expected object but got ${data}`, options);
	const result = {};
	for (const key in dict) {
		const value = property(data, key, dict[key], options);
		if (!isNullable(value) || key in data) result[key] = value;
	}
	if (!strict) merge(result, data);
	return [result];
});
Schema.extend("union", (data, { list, toString }, options, strict) => {
	const messages = [];
	for (const inner of list) try {
		return Schema.resolve(data, inner, options, strict);
	} catch (error) {
		messages.push(error);
	}
	throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
});
Schema.extend("intersect", (data, { list, toString }, options, strict) => {
	if (!list.length) return [data];
	let result;
	for (const inner of list) {
		const value = Schema.resolve(data, inner, options, true)[0];
		if (isNullable(value)) continue;
		if (isNullable(result)) result = value;
		else if (typeof result !== typeof value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
		else if (typeof value === "object") merge(result ??= {}, value);
		else if (result !== value) throw new ValidationError(`expected ${toString()} but got ${JSON.stringify(data)}`, options);
	}
	if (!strict && isPlainObject(data)) merge(result, data);
	return [result];
});
Schema.extend("transform", (data, { inner, callback, preserve }, options) => {
	const [result, adapted = data] = Schema.resolve(data, inner, options, true);
	if (preserve) return [callback(result)];
	else return [callback(result), callback(adapted)];
});
const formatters = {};
function defineMethod(name, keys, format) {
	formatters[name] = format;
	Object.assign(Schema, { [name](...args) {
		const schema = new Schema({ type: name });
		keys.forEach((key, index) => {
			switch (key) {
				case "sKey":
					schema.sKey = args[index] ?? Schema.string();
					break;
				case "inner":
					schema.inner = Schema.from(args[index]);
					break;
				case "list":
					schema.list = args[index].map(Schema.from);
					break;
				case "dict":
					schema.dict = mapValues(args[index], Schema.from);
					break;
				case "bits":
					schema.bits = {};
					for (const key in args[index]) {
						if (typeof args[index][key] !== "number") continue;
						schema.bits[key] = args[index][key];
					}
					break;
				case "callback": {
					const callback = schema.callback = args[index];
					callback["toJSON"] ||= () => callback.toString();
					break;
				}
				case "constructor": {
					const constructor = schema.constructor = args[index];
					if (typeof constructor === "function") constructor["toJSON"] ||= () => constructor["name"];
					break;
				}
				default: schema[key] = args[index];
			}
		});
		if (name === "object" || name === "dict") schema.meta.default = {};
		else if (name === "array" || name === "tuple") schema.meta.default = [];
		else if (name === "bitset") schema.meta.default = 0;
		return schema;
	} });
}
defineMethod("is", ["constructor"], ({ constructor }) => {
	if (typeof constructor === "function") return constructor.name;
	else return constructor;
});
defineMethod("any", [], () => "any");
defineMethod("never", [], () => "never");
defineMethod("const", ["value"], ({ value }) => typeof value === "string" ? JSON.stringify(value) : value);
defineMethod("string", [], () => "string");
defineMethod("number", [], () => "number");
defineMethod("boolean", [], () => "boolean");
defineMethod("bitset", ["bits"], () => "bitset");
defineMethod("function", [], () => "function");
defineMethod("array", ["inner"], ({ inner }) => `${inner.toString(true)}[]`);
defineMethod("dict", ["inner", "sKey"], ({ inner, sKey }) => `{ [key: ${sKey.toString()}]: ${inner.toString()} }`);
defineMethod("tuple", ["list"], ({ list }) => `[${list.map((inner) => inner.toString()).join(", ")}]`);
defineMethod("object", ["dict"], ({ dict }) => {
	if (Object.keys(dict).length === 0) return "{}";
	return `{ ${Object.entries(dict).map(([key, inner]) => {
		return `${key}${inner.meta.required ? "" : "?"}: ${inner.toString()}`;
	}).join(", ")} }`;
});
defineMethod("union", ["list"], ({ list }, inline) => {
	const result = list.map(({ toString: format }) => format()).join(" | ");
	return inline ? `(${result})` : result;
});
defineMethod("intersect", ["list"], ({ list }) => {
	return `${list.map((inner) => inner.toString(true)).join(" & ")}`;
});
defineMethod("transform", [
	"inner",
	"callback",
	"preserve"
], ({ inner }, isInner) => inner.toString(isInner));
//#endregion
//#region lib/types/index.js
/**
* Remote exposure of the `ctx.git` capability seam as the `gitRemote` Typert
* Remote namespace for the Web Client: every request carries the session id —
* this service resolves the workspace root from the live session, so the
* panel always means the session's own repository — and every answer is a
* discriminated result (`ok` carries the wire view, `false` carries the
* panel-renderable error, with `denied` when the standing sandbox policy
* blocked a mutation). A Remote call never rejects.
*
* `generateCommitMessage` adds one auxiliary model call: it frames the staged
* diff, streams exactly one completion through `ctx.llm` under the configured
* provider+model route, and normalizes the reply into commit-message text.
* With no route configured it answers the honest not-configured failure.
*
* @module @dsh-custom/dsh-git-remote
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
var __addDisposableResource = function(env, value, async) {
	if (value !== null && value !== void 0) {
		if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
		var dispose, inner;
		if (async) {
			if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
			dispose = value[Symbol.asyncDispose];
		}
		if (dispose === void 0) {
			if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
			dispose = value[Symbol.dispose];
			if (async) inner = dispose;
		}
		if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
		if (inner) dispose = function() {
			try {
				inner.call(this);
			} catch (e) {
				return Promise.reject(e);
			}
		};
		env.stack.push({
			value,
			dispose,
			async
		});
	} else if (async) env.stack.push({ async: true });
	return value;
};
var __disposeResources = (function(SuppressedError) {
	return function(env) {
		function fail(e) {
			env.error = env.hasError ? new SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
			env.hasError = true;
		}
		var r, s = 0;
		function next() {
			while (r = env.stack.pop()) try {
				if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
				if (r.dispose) {
					var result = r.dispose.call(r.value);
					if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) {
						fail(e);
						return next();
					});
				} else s |= 1;
			} catch (e) {
				fail(e);
			}
			if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
			if (env.hasError) throw env.error;
		}
		return next();
	};
})(typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
	var e = new Error(message);
	return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
});
/**
* Run one seam call and project it onto the wire result: a `GitError`
* becomes the failure the panel renders (with `denied` for policy blocks),
* any other throw becomes an honest infrastructure failure message.
* @param body - one seam call returning the wire view.
*/
async function answer(body) {
	try {
		return {
			ok: true,
			value: await body()
		};
	} catch (error) {
		if (error instanceof GitError) return {
			ok: false,
			error: error.message,
			...error.denied ? { denied: true } : {}
		};
		return {
			ok: false,
			error: error instanceof Error ? error.message : String(error)
		};
	}
}
/** Project one status summary onto its wire view. */
function statusView(summary) {
	return {
		root: summary.root,
		ahead: summary.ahead,
		behind: summary.behind,
		initial: summary.initial,
		detached: summary.detached,
		...summary.branch !== void 0 ? { branch: summary.branch } : {},
		...summary.upstream !== void 0 ? { upstream: summary.upstream } : {},
		entries: summary.entries.map((entry) => ({
			code: entry.code,
			path: entry.path,
			staged: entry.staged,
			unstaged: entry.unstaged,
			untracked: entry.untracked,
			...entry.originPath !== void 0 ? { originPath: entry.originPath } : {}
		}))
	};
}
/** Project one diff result onto its wire view. */
function diffView(result) {
	return {
		staged: result.staged,
		patch: result.patch,
		truncated: result.truncated,
		...result.path !== void 0 ? { path: result.path } : {}
	};
}
/** Project one log result onto its wire view. */
function logView(result) {
	return { entries: result.entries.map((entry) => ({ ...entry })) };
}
/** Project one branch list onto its wire view. */
function branchesView(result) {
	return { branches: result.branches.map((branch) => ({
		name: branch.name,
		current: branch.current,
		shortHash: branch.shortHash,
		...branch.upstream !== void 0 ? { upstream: branch.upstream } : {}
	})) };
}
/** Project one staging result onto its wire view. */
function stageView(result) {
	return { stagedPaths: result.stagedPaths.map((path) => path) };
}
/** System prompt for the auxiliary commit-message completion. */
const COMMIT_MESSAGE_SYSTEM = [
	"You write git commit messages.",
	"Reply with ONLY the commit message: one concise subject line (at most 72 characters, imperative mood, no trailing period),",
	"optionally followed by a blank line and a short body explaining what changed and why.",
	"No surrounding quotes, no markdown code fences, no commentary."
].join(" ");
/** Cap of the normalized message the service ever returns. */
const MAX_MESSAGE_LENGTH = 1e3;
/**
* Normalize one model reply into commit-message text: strip code fences and
* stray quoting, collapse blank runs, and cap the length.
* @param text - the assembled model text.
* @returns the normalized message.
*/
function normalizeCommitMessage(text) {
	let message = text.trim();
	const fenced = /^```[a-zA-Z]*\n([\s\S]*?)\n```$/.exec(message);
	if (fenced !== null) message = fenced[1]?.trim() ?? message;
	message = message.replace(/^["'`]+|[`"']+$/g, "").replace(/\n{3,}/g, "\n\n").trim();
	return message.slice(0, MAX_MESSAGE_LENGTH);
}
/**
* Translate one terminal finish reason into the auxiliary-call failure.
* @param finish - the assembled stream's terminal reason.
* @returns the failure, or undefined for a clean stop.
*/
function finishError(finish) {
	switch (finish.kind) {
		case "stop": return;
		case "error":
		case "aborted": return new Error(finish.failure.message);
		case "max-tokens": return /* @__PURE__ */ new Error("git-remote: commit message reached maxOutputTokens");
		case "tool-calls": return /* @__PURE__ */ new Error("git-remote: commit message model unexpectedly requested a tool");
	}
}
let GitRemoteService = (() => {
	let _classSuper = TypertRemoteService;
	let _instanceExtraInitializers = [];
	let _status_decorators;
	let _diff_decorators;
	let _log_decorators;
	let _branches_decorators;
	let _stage_decorators;
	let _unstage_decorators;
	let _commit_decorators;
	let _push_decorators;
	let _generateCommitMessage_decorators;
	let _checkpoints_decorators;
	let _restoreCheckpoint_decorators;
	return class GitRemoteService extends _classSuper {
		static {
			const _metadata = typeof Symbol === "function" && Symbol.metadata ? Object.create(_classSuper[Symbol.metadata] ?? null) : void 0;
			_status_decorators = [Remote("status")];
			_diff_decorators = [Remote("diff")];
			_log_decorators = [Remote("log")];
			_branches_decorators = [Remote("branches")];
			_stage_decorators = [Remote("stage")];
			_unstage_decorators = [Remote("unstage")];
			_commit_decorators = [Remote("commit")];
			_push_decorators = [Remote("push")];
			_generateCommitMessage_decorators = [Remote("generateCommitMessage")];
			_checkpoints_decorators = [Remote("checkpoints")];
			_restoreCheckpoint_decorators = [Remote("restoreCheckpoint")];
			__esDecorate(this, null, _status_decorators, {
				kind: "method",
				name: "status",
				static: false,
				private: false,
				access: {
					has: (obj) => "status" in obj,
					get: (obj) => obj.status
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _diff_decorators, {
				kind: "method",
				name: "diff",
				static: false,
				private: false,
				access: {
					has: (obj) => "diff" in obj,
					get: (obj) => obj.diff
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _log_decorators, {
				kind: "method",
				name: "log",
				static: false,
				private: false,
				access: {
					has: (obj) => "log" in obj,
					get: (obj) => obj.log
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _branches_decorators, {
				kind: "method",
				name: "branches",
				static: false,
				private: false,
				access: {
					has: (obj) => "branches" in obj,
					get: (obj) => obj.branches
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _stage_decorators, {
				kind: "method",
				name: "stage",
				static: false,
				private: false,
				access: {
					has: (obj) => "stage" in obj,
					get: (obj) => obj.stage
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _unstage_decorators, {
				kind: "method",
				name: "unstage",
				static: false,
				private: false,
				access: {
					has: (obj) => "unstage" in obj,
					get: (obj) => obj.unstage
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _commit_decorators, {
				kind: "method",
				name: "commit",
				static: false,
				private: false,
				access: {
					has: (obj) => "commit" in obj,
					get: (obj) => obj.commit
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _push_decorators, {
				kind: "method",
				name: "push",
				static: false,
				private: false,
				access: {
					has: (obj) => "push" in obj,
					get: (obj) => obj.push
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _generateCommitMessage_decorators, {
				kind: "method",
				name: "generateCommitMessage",
				static: false,
				private: false,
				access: {
					has: (obj) => "generateCommitMessage" in obj,
					get: (obj) => obj.generateCommitMessage
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _checkpoints_decorators, {
				kind: "method",
				name: "checkpoints",
				static: false,
				private: false,
				access: {
					has: (obj) => "checkpoints" in obj,
					get: (obj) => obj.checkpoints
				},
				metadata: _metadata
			}, null, _instanceExtraInitializers);
			__esDecorate(this, null, _restoreCheckpoint_decorators, {
				kind: "method",
				name: "restoreCheckpoint",
				static: false,
				private: false,
				access: {
					has: (obj) => "restoreCheckpoint" in obj,
					get: (obj) => obj.restoreCheckpoint
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
		static inject = [
			"sessions",
			"git",
			"llm"
		];
		static Config = Schema.object({
			provider: Schema.string(),
			model: Schema.string(),
			maxDiffBytes: Schema.number().default(65536),
			maxOutputTokens: Schema.number().default(128),
			timeoutMs: Schema.number().default(6e4)
		});
		config = __runInitializers(this, _instanceExtraInitializers);
		constructor(ctx, config = {}) {
			super(ctx, "gitRemote");
			this.config = {
				maxDiffBytes: config.maxDiffBytes ?? 65536,
				maxOutputTokens: config.maxOutputTokens ?? 128,
				timeoutMs: config.timeoutMs ?? 6e4,
				...config.provider !== void 0 ? { provider: config.provider } : {},
				...config.model !== void 0 ? { model: config.model } : {}
			};
		}
		/**
		* Resolve the workspace directory of one live session.
		* @param sessionId - the session whose repository the call addresses.
		* @returns the cwd, or the ready-made failure answer when the session is
		* unknown or carries no cwd.
		*/
		resolve(sessionId) {
			const cwd = this.ctx.sessions.get(sessionId)?.header.cwd;
			if (cwd === void 0 || cwd === "") return { failure: {
				ok: false,
				error: `session ${String(sessionId)} has no workspace directory`
			} };
			return { cwd };
		}
		/**
		* `gitRemote.status`: the session repository's working-tree status.
		* @param request - the session whose repository to read.
		* @returns the status view, or the failure the panel renders.
		*/
		async status(request) {
			const resolved = this.resolve(request.sessionId);
			if ("failure" in resolved) return resolved.failure;
			const cwd = resolved.cwd;
			return await answer(async () => statusView(await this.ctx.git.status(cwd)));
		}
		/**
		* `gitRemote.diff`: one unified diff of the session repository.
		* @param request - the session, staged/work-tree selection, and optional path filter.
		* @returns the patch view, or the failure the panel renders.
		*/
		async diff(request) {
			const resolved = this.resolve(request.sessionId);
			if ("failure" in resolved) return resolved.failure;
			const cwd = resolved.cwd;
			return await answer(async () => diffView(await this.ctx.git.diff(cwd, {
				staged: request.staged === true,
				...request.path !== void 0 && request.path !== "" ? { path: request.path } : {}
			})));
		}
		/**
		* `gitRemote.log`: the session repository's commit list.
		* @param request - the session, count bound, optional revision and path filter.
		* @returns the commit list view, or the failure the panel renders.
		*/
		async log(request) {
			const resolved = this.resolve(request.sessionId);
			if ("failure" in resolved) return resolved.failure;
			const cwd = resolved.cwd;
			return await answer(async () => logView(await this.ctx.git.log(cwd, {
				...request.maxCount !== void 0 ? { maxCount: request.maxCount } : {},
				...request.ref !== void 0 && request.ref !== "" ? { ref: request.ref } : {},
				...request.path !== void 0 && request.path !== "" ? { path: request.path } : {}
			})));
		}
		/**
		* `gitRemote.branches`: the session repository's local branches.
		* @param request - the session whose repository to read.
		* @returns the branch list view, or the failure the panel renders.
		*/
		async branches(request) {
			const resolved = this.resolve(request.sessionId);
			if ("failure" in resolved) return resolved.failure;
			const cwd = resolved.cwd;
			return await answer(async () => branchesView(await this.ctx.git.branches(cwd)));
		}
		/**
		* `gitRemote.stage`: stage work-tree changes into the index.
		* @param request - the session and the paths (or the whole work tree).
		* @returns the cumulative staged paths, or the failure the panel renders.
		*/
		async stage(request) {
			const resolved = this.resolve(request.sessionId);
			if ("failure" in resolved) return resolved.failure;
			const cwd = resolved.cwd;
			return await answer(async () => stageView(await this.ctx.git.stage(cwd, {
				...request.paths !== void 0 && request.paths.length > 0 ? { paths: request.paths } : {},
				...request.all === true ? { all: true } : {}
			})));
		}
		/**
		* `gitRemote.unstage`: return index entries to HEAD.
		* @param request - the session and the paths (or the whole index).
		* @returns the cumulative staged paths, or the failure the panel renders.
		*/
		async unstage(request) {
			const resolved = this.resolve(request.sessionId);
			if ("failure" in resolved) return resolved.failure;
			const cwd = resolved.cwd;
			return await answer(async () => stageView(await this.ctx.git.unstage(cwd, {
				...request.paths !== void 0 && request.paths.length > 0 ? { paths: request.paths } : {},
				...request.all === true ? { all: true } : {}
			})));
		}
		/**
		* `gitRemote.commit`: create one commit from the staged index.
		* @param request - the session and the commit message.
		* @returns the created commit's identity, or the failure the panel renders.
		*/
		async commit(request) {
			const resolved = this.resolve(request.sessionId);
			if ("failure" in resolved) return resolved.failure;
			const cwd = resolved.cwd;
			return await answer(async () => {
				const result = await this.ctx.git.commit(cwd, { message: request.message });
				return {
					hash: result.hash,
					shortHash: result.shortHash,
					subject: result.subject
				};
			});
		}
		/**
		* `gitRemote.push`: push the current branch to its upstream or an explicit remote.
		* @param request - the session, optional remote/branch, and upstream setup.
		* @returns the push target echo, or the failure the panel renders.
		*/
		async push(request) {
			const resolved = this.resolve(request.sessionId);
			if ("failure" in resolved) return resolved.failure;
			const cwd = resolved.cwd;
			return await answer(async () => {
				const result = await this.ctx.git.push(cwd, {
					...request.remote !== void 0 && request.remote !== "" ? { remote: request.remote } : {},
					...request.branch !== void 0 && request.branch !== "" ? { branch: request.branch } : {},
					...request.setUpstream === true ? { setUpstream: true } : {}
				});
				return {
					remote: result.remote,
					branch: result.branch,
					setUpstream: result.setUpstream
				};
			});
		}
		/**
		* `gitRemote.generateCommitMessage`: one auxiliary model completion that
		* drafts the commit message from the staged diff. Requires the
		* provider+model route to be configured on this row; without it the answer
		* is the honest not-configured failure.
		* @param request - the session whose staged diff to frame.
		* @returns the drafted message, or the failure the panel renders.
		*/
		async generateCommitMessage(request) {
			const provider = this.config.provider;
			const model = this.config.model;
			if (provider === void 0 || model === void 0) return {
				ok: false,
				error: "git-remote: commit-message generation is not configured; set provider and model together on the git-remote row"
			};
			const resolved = this.resolve(request.sessionId);
			if ("failure" in resolved) return resolved.failure;
			const cwd = resolved.cwd;
			return await answer(async () => {
				const env_1 = {
					stack: [],
					error: void 0,
					hasError: false
				};
				try {
					const diff = await this.ctx.git.diff(cwd, {
						staged: true,
						maxBytes: this.config.maxDiffBytes
					});
					if (diff.patch.trim() === "") throw new GitError("nothing is staged; stage changes before generating a commit message", 1, "");
					const messages = [createUserMessage({
						content: [{
							type: "text",
							text: `Write the commit message for these staged changes:\n\n${diff.patch}\n${diff.truncated ? "\n(the diff was truncated at its tail)\n" : ""}`
						}],
						source: {
							kind: "plugin",
							plugin: "dsh-git-remote"
						}
					})];
					const callDeadline = __addDisposableResource(env_1, deadline(void 0, this.config.timeoutMs, "GIT_COMMIT_MESSAGE_TIMEOUT"), false);
					const options = {
						provider,
						model,
						messages,
						system: COMMIT_MESSAGE_SYSTEM,
						maxTokens: this.config.maxOutputTokens,
						signal: callDeadline.signal
					};
					const assembler = new BlockAssembler();
					for await (const chunk of this.ctx.llm.stream(options)) {
						callDeadline.signal.throwIfAborted();
						assembler.push(chunk);
					}
					const terminalError = finishError(assembler.finish);
					if (terminalError !== void 0) throw terminalError;
					const blocks = assembler.blocks();
					if (blocks.some((block) => block.type === "tool-call")) throw new Error("git-remote: the commit-message model returned a tool call");
					const message = normalizeCommitMessage(blocks.filter((block) => block.type === "text").map((block) => block.text).join(" "));
					if (message === "") throw new Error("git-remote: the commit-message model produced no text");
					return { message };
				} catch (e_1) {
					env_1.error = e_1;
					env_1.hasError = true;
				} finally {
					__disposeResources(env_1);
				}
			});
		}
		/**
		* `gitRemote.checkpoints`: the session's checkpoint series, newest first.
		* @param request - the session whose checkpoint series to read.
		* @returns the checkpoint list view, or the failure the panel renders.
		*/
		async checkpoints(request) {
			const resolved = this.resolve(request.sessionId);
			if ("failure" in resolved) return resolved.failure;
			const cwd = resolved.cwd;
			const series = String(request.sessionId);
			return await answer(async () => {
				return { checkpoints: (await this.ctx.git.checkpoints(cwd, series)).checkpoints.map((checkpoint) => ({ ...checkpoint })) };
			});
		}
		/**
		* `gitRemote.restoreCheckpoint`: return work-tree files to one checkpoint.
		* @param request - the session, the checkpoint ordinal, and optional paths.
		* @returns the restored echo, or the failure the panel renders.
		*/
		async restoreCheckpoint(request) {
			const resolved = this.resolve(request.sessionId);
			if ("failure" in resolved) return resolved.failure;
			const cwd = resolved.cwd;
			const series = String(request.sessionId);
			const paths = request.paths?.filter((path) => path.trim() !== "") ?? [];
			return await answer(async () => {
				return { restored: (await this.ctx.git.checkpointRestore(cwd, {
					series,
					index: request.index,
					...paths.length > 0 ? { paths } : {}
				})).restored.map((path) => path) };
			});
		}
	};
})();
//#endregion
export { GitRemoteService, GitRemoteService as default };
