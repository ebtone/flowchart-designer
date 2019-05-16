/**
 * Flowchart Graphics
 */
(function(root, factory) {
	if (typeof(define) == 'function' && define.amd) {
		define(function() {
			return factory(root, root.document)
		})
	} else if (typeof(exports) == 'object') {
		module.exports = root.document ? factory(root, root.document) : function(w) {
			return factory(w, w.document)
		}
	} else {
		root.Graphics = factory(root, root.document)
	}
}(typeof(window) != 'undefined' ? window : this, function(window, document){	
	var Graphics = this.Graphics = function(elem){
		return new Graphics.DOMElement(elem);
	};

	Graphics.SVG = {
		tag: 'svg',
		ns: 'http://www.w3.org/2000/svg',
		xmlns: 'http://www.w3.org/2000/xmlns/',
		xlink: 'http://www.w3.org/1999/xlink',
		esvg: 'http://www.ebtone.com/esvg'
	};

	Graphics.VML = {
		tag: 'group',
		vns: 'urn:schemas-microsoft-com:vml',
		ons: 'urn:schemas-microsoft-com:office:office',
		supported: !(!!document.createElementNS && !!document.createElementNS(Graphics.SVG.ns, Graphics.SVG.tag).createSVGRect)
	};

	Graphics.Config = {
		/* internal */
		_MIN_FLOAT: -3.4e+38,
		_MAX_FLOAT: +3.4e+38,
		/* external */
		index: 1,
		browser: {
			lang: (window.navigator.language || window.navigator.browserLanguage),
			msie: (/MSIE [1-9]/ig.test(window.navigator.userAgent) || 'ActiveXObject' in window)
		},
		defaultAttrs: {
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			leading: 1.2,
			aligning: 'xMidyMid',
			'class': '',
			'style': '',
			'font-size': 12,
			'font-family': 'Microsoft YaHei,Tahoma,Verdana,Arial,\\5b8b\\4f53'
		},
		specialAttrs: {
			fillColor: 'fillColor',
			strokeColor: 'strokeColor',
			strokeWeight: 'strokeWeight',
			tabIndex: 'tabIndex',
			readOnly: 'readOnly',
			'for': 'htmlFor',
			'class': 'className',
			maxLength: 'maxLength',
			cellSpacing: 'cellSpacing',
			cellPadding: 'cellPadding',
			rowSpan: 'rowSpan',
			colSpan: 'colSpan',
			useMap: 'useMap',
			frameBorder: 'frameBorder',
			contentEditable: 'contentEditable'
		},
		quoteExpr: /[\\\"\u0000-\u001f\u007f-\u009f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
		quoteMeta: {
			'\b': '\\b',
			'\t': '\\t',
			'\n': '\\n',
			'\f': '\\f',
			'\r': '\\r',
			'"': '\\"',
			'\\': '\\\\'
		}
	};

	Graphics.Api = {
		gid: function(name){
			return (name ? (Graphics.Painter.tag + '-' + name) : Graphics.Painter.tag) + '-' + (Graphics.Config.index++);
		},
		lpad: function(str, size, padStr){
			while (str.length < size) {
				str = padStr + str;
			}
			return str.length > size ? str.substring(size - str.length) : str;
		},
		rpad: function(str, size, padStr){
			while (str.length < size) {
				str += padStr;
			}
			return str.length > size ? str.substring(0, size) : str;
		},
		now: function(){
			var date = new Date();
			return date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate() + ' ' + date.getHours() + ':' + date.getMinutes() + ':' + date.getSeconds();
		},
		timestamp: function(){
			var date = new Date();
			return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
		},
		box: function(box){
			if (box.x == null) {
				box.x = box.y = box.width = box.height = 0;
			}
			box.w  = box.width
			box.h  = box.height
			box.x2 = box.x + box.width
			box.y2 = box.y + box.height
			box.cx = box.x + box.width / 2
			box.cy = box.y + box.height / 2
			return box;
		},
		bringToFront: function(dom){
			dom.parentNode.lastChild !== dom && dom.parentNode.appendChild(dom);
		},
		bringForward: function(dom){
			dom.nextSibling && dom.parentNode.insertBefore(dom.nextSibling, dom);
		},
		sendToBack: function(dom){
			dom.parentNode.insertBefore(dom, dom.parentNode.firstChild);
		},
		sendBackward: function(dom){
			dom.previousSibling && dom.parentNode.insertBefore(dom, dom.previousSibling);
		},
		adorn: function(dom){
			if (!dom) {
				return null;
			} else if (dom.instance) {
				return dom.instance;
			} else if (typeof(dom) == 'string') {
				return arguments.callee(Graphics.Api.selectOne(dom));
			} else if (dom.dom === dom) {
				return dom;
			}
			var shape = new (Graphics.SVG[dom.nodeName.toLowerCase()] || Graphics.VML[dom.nodeName.toLowerCase()] || Graphics.Element)(dom);
			shape.type = dom.nodeName;
			shape.dom = dom;
			dom.instance = shape;
			shape.data(Graphics.Api.toJSON(dom.getAttribute(Graphics.Painter.tag + ':data')) || {})
			return shape;
		},
		throttle: function(millisecs, fn) {
			var lastModified = 0;
			return function(){
				var nowTime = new Date().getTime(), diff = nowTime - lastModified;
				if (diff >= millisecs) {
					lastModified = nowTime;
					fn.apply(this, arguments);
				}
			};
		},
		matches: function(dom, selector){
			return dom && selector && dom.nodeType != 3 && (dom.matches || dom.matchesSelector || dom.webkitMatchesSelector || dom.msMatchesSelector || dom.mozMatchesSelector || dom.oMatchesSelector || (dom = jQuery(dom)).is).call(dom, selector);
		},
		reassignId: function(dom){
			for (var i = dom.childNodes.length - 1; i >= 0; i--) {
				if (dom.childNodes[i].nodeType == 1) {
					arguments.callee(dom.childNodes[i])
				}
			}
			dom.setAttribute('id', Graphics.Api.gid(dom.tagName));
			return dom;
		},
		outerHTML: function(dom){
			if (dom && dom.tagName && dom.nodeName) {
				if ('outerHTML' in dom) {
					return dom.outerHTML;
				} else {
					for (var i = 0, html = ['<', dom.tagName], attrs = dom.attributes; i < attrs.length; i++) {
						html.push(' ', attrs[i].name, '="', attrs[i].value, '"');
					}
					html.push('>', dom.innerHTML, '</', dom.tagName, '>');
					return html.join('');
				}
			}
		},
		selectOne: function(selector){
			return document.querySelector(selector) || jQuery(selector)[0];
		},
		selectAll: function(selector){
			return document.querySelectorAll(selector) || jQuery(selector);
		},
		trim: function(str){
			return str ? str.replace(/^\s+|\s+$/, '') : '';
		},
		trimAndSplit: function(str, exp){
			return Graphics.Api.trim(str).split(exp || /\s+/);
		},
		coordinate: function(dom){
			var pos = { x: dom.offsetLeft, y: dom.offsetTop };
			while (dom = dom.offsetParent) {
				pos.x += dom.offsetLeft;
				pos.y += dom.offsetTop;
			}
			pos.left = pos.x;
			pos.top = pos.y;
			return pos;
		},
		pageOffset: function(){
			var doc = document.documentElement, body = document.body;
			return { left: (window.pageXOffset || doc && doc.scrollLeft || body && body.scrollLeft || 0), top: (window.pageYOffset || doc && doc.scrollTop || body && body.scrollTop || 0) };
		},
		type: function(o){
			return o === void 0 ? '[object Undefined]' : o === null ? '[object Null]' : Object.prototype.toString.call(o);
		},
		isArray: function(o){
			return Graphics.Api.type(o) == '[object Array]';
		},
		isObject: function(o){
			return Graphics.Api.type(o) == '[object Object]';
		},
		isJQueryObject: function(o){
			return o && $ && o.jquery === $.prototype.jquery && o.constructor === $.prototype.constructor;
		},
		isRgbColor: function(color){
			return color && ((typeof(color.r) == 'number' && typeof(color.g) == 'number' && typeof(color.b) == 'number') || /^rgb\(/i.test(color));
		},
		isHexColor: function(color){
			return /^#[0-9a-f]{3,6}$/i.test(color);
		},
		isColor: function(color){
			return Graphics.Api.isHexColor(color) || Graphics.Api.isRgbColor(color);
		},
		toPt: function(px){
			return Math.round(parseFloat(px) * 72 / 96);
		},
		toPx: function(pt){
			return Math.round(parseFloat(pt) * 96 / 72);
		},
		toHex: function(){
			for (var i = 0, hex =[]; i < arguments.length; i++) {
				hex.push(Graphics.Api.lpad(Number(arguments[i]).toString(16), 2, '0'));
			}
			return hex.join('');
		},
		toHexColor: function(color){
			if (Graphics.Api.isHexColor(color)) {
				return color;
			} else if (Graphics.Api.isRgbColor(color)) {
				return '#' + Graphics.Api.toHex.apply(this, typeof(color) == 'string' ? color.replace(/[^0-9,]/g, '').split(',') : [color.r, color.g, color.b]);
			}
		},
		toRgbColor: function(color){
			if (Graphics.Api.isRgbColor(color)) {
				return typeof(color) == 'string' ? color : 'rgb(' + [color.r, color.g, color.b] + ')'
			} else if (Graphics.Api.isHexColor(color)) {
				color = color.match(new RegExp('[0-9a-z]{' + (color.length == 4 ? 1 : 2) + '}', 'ig'));
				return 'rgb(' + [parseInt(color[0], 16), parseInt(color[1], 16), parseInt(color[2], 16)] + ')';
			}
		},
		quote: function(str){
			Graphics.Config.quoteExpr.lastIndex = 0;
			return Graphics.Config.quoteExpr.test(str) ? str.replace(Graphics.Config.quoteExpr, function(keyword){ return Graphics.Config.quoteMeta[keyword] || '\\u' + ('0000' + keyword.charCodeAt(0).toString(16)).slice(-4) }) : str;
		},
		toJSON: function(str){
			return typeof(str) == 'string' ? (new Function('return ' + str))() : null;
		},
		stringify: function(obj){
			var dejaVu = [], sep, serialize = function(data, buf, path){
				if (dejaVu.indexOf(data) != -1) {
					throw new Error('Infinite recursion error (through reference chain: ' + path + ')');
				}
				switch (Graphics.Api.type(data)) {
				case '[object Array]':
					dejaVu.push(data);
					buf.push('[');
					sep = '';
					for (var key in data) {
						buf.push(sep);
						serialize(data[key], buf, path + '[' + key + ']');
						sep = ',';
					}
					buf.push(']');
					break;
				case '[object Object]':
					dejaVu.push(data);
					buf.push('{');
					sep = '';
					for (var key in data) {
						buf.push(sep, '"', key, '":');
						serialize(data[key], buf, path + '[\'' + key + '\']');
						sep = ',';
					}
					buf.push('}');
					break;
				case '[object String]':
					buf.push('"', Graphics.Api.quote(data), '"');
					break;
				case '[object Number]':
					buf.push(data);
					break;
				case '[object Undefined]':
				case '[object Null]':
					buf.push('null');
					break;
				case '[object Date]':
					buf.push('"', data.getFullYear(), '-', data.getMonth() + 1, '-', data.getDate(), ' ', data.getHours(), ':', data.getMinutes(), ':', data.getSeconds(), '"');
					break;
				case '[object Boolean]':
					buf.push(data ? 'true' : 'false');
					break;
				default:
					buf.push('"', Graphics.Api.quote(String(data)), '"');
					break;
				}
				return buf;
			};
			return serialize(obj, [], '#root').join('');
		}
	};

	Graphics.extend = function(){
		var objects = Array.prototype.slice.call(arguments), methods = objects.pop(), obj;
		if (Graphics.Api.isObject(methods)) {
			for (var name in objects) {
				obj = objects[name];
				if (obj.prototype) {
					obj = obj.prototype;
				}
				for (name in methods) {
					obj[name] = methods[name];
				}
			}
		}
	};

	Graphics.create = function(config){
		var ctor = typeof(config.create) == 'function' ? config.create : function(){ this.constructor.call(this, Graphics.Painter.create(config.create)) }
		if (config.superclass) {
			ctor.prototype = new config.superclass;
		}
		if (config.methods) {
			/* cascading */
			for (var name in config.methods) {
				if (/^[^_]/.test(name)) {
					config.methods[name] = (function(name, fn){
						return function(){
							if (this instanceof Graphics.VirtualDOM) {
								return this;
							}
							var args = arguments, val;
							if (this instanceof Graphics.DOMElementList && !Array.prototype[name] && name in Graphics.DOMElement.prototype) {
								this.forEach(function(item){ val = fn.apply(item, args) }, this);
								return this;
							} else {
								return (val = fn.apply(this, args)) && Graphics.Api.isArray(val) ? new Graphics.DOMElementList(this, val) : val;
							}
						};
					})(name, config.methods[name]);
				}
			}
			Graphics.extend(ctor, config.methods);
		}
		if (config.constructors) {
			Graphics.extend(config.parent || Graphics.Container, config.constructors);
		}
		return ctor;
	};

	Graphics.Element = Graphics.create({
		create: function(dom){
			this._stroke = '#000';
			this.json = {};
			if (this.dom = dom) {
				this.type = dom.nodeName;
				this.dom.instance = this;
				this._stroke = this.dom.getAttribute('stroke') || this._stroke;
			}
		},
		methods: {
			css: function(x, v){
				var t = typeof(x), cs = this.dom.currentStyle || window.getComputedStyle(this.dom, null), fn = function(n){ return cs.getPropertyValue && cs.getPropertyValue(n) || cs[n] };
				if (x === void 0) {
					x = {};
					for (v in cs) {
						x[v] = fn(v);
					}
					return x;
				} else if (t == 'object') {
					for (v in x) {
						this.css(v, x[v]);
					}
				} else if (t == 'string' && v === void 0) {
					return fn(x);
				} else if (t == 'string' && v === null) {
					this.dom.style.cssText = this.dom.style.cssText.replace(new RegExp('(;|\\s*)' + x + '\\s*:[^;]*\\1', 'ig'), '');
				} else {
					this.dom.style[x] = (typeof(v) == 'function' ? v.call(this, fn(x)) : v);
				}
				return this;
			},
			offset: function(){
				var box = this.dom.getBoundingClientRect(), offset = Graphics.Api.pageOffset();
				return { left: box.left + offset.left, top: box.top + offset.top };
			},
			position: function(x){
				var pos = this.offset();
				if (x && (x = this.parent(x))) {
					x = x.offset();
					pos.left -= x.left;
					pos.top -= x.top;
				}
				return pos;
			},
			hide: function(){
				return this.removeClass('show').addClass('hide').css('display', 'none');
			},
			show: function(){
				return this.removeClass('hide').addClass('show').css('display', null);
			},
			classes: function(){
				return Graphics.Api.trimAndSplit(this.attr('class'));
			},
			hasClass: function(name){
				return this.classes().indexOf(name) != -1;
			},
			addClass: function(name){
				Graphics.Api.trimAndSplit(name).forEach(function(item){ !this.hasClass(item) && this.attr('class', this.classes().concat(item).join(' ')) }, this);
				return this;
			},
			removeClass: function(name){
				Graphics.Api.trimAndSplit(name).forEach(function(item){ this.hasClass(item) && this.attr('class', this.attr('class').replace(new RegExp('(\\s|^)' + item + '(\\s|$)', 'g'), function(){ return RegExp.$1 && RegExp.$2 ? ' ' : '' })) }, this);
				return this;
			},
			toggleClass: function(name){
				return this.hasClass(name) ? this.removeClass(name) : this.addClass(name);
			},
			removeAttr: function(name){
				return this.attr(name, null);
			},
			attr: function(x, v, ns){
				var t = typeof(x);
				if (x === void 0) {
					for (x = {}, v = this.dom.attributes, n = v.length - 1; n >= 0; n--) {
						x[v[n].nodeName] = this.attr(v[n].nodeName);
					}
					return x;
				} else if (t == 'object') {
					for (v in x) {
						this.attr(v, x[v]);
					}
				} else if (t == 'string' && v === void 0) {
					v = (Graphics.VML.supported && Graphics.Config.specialAttrs[x] && this.dom[Graphics.Config.specialAttrs[x]]) || (typeof(ns) == 'string' ? this.dom.getAttributeNS(ns, x) : this.dom.getAttribute(x));
					return v == null ? Graphics.Config.defaultAttrs[x] : (isNaN(v) ? v : parseFloat(v));
				} else if (t == 'string' && (v === null || v === '')) {
					Graphics.VML.supported && Graphics.Config.specialAttrs[x] ? (this.dom[Graphics.Config.specialAttrs[x]] = '') : this.dom.removeAttribute(x);
				} else {
					/* conv */
					if (typeof(v) == 'number') {
						v = isNaN(v) ? 0 : !isFinite(v) ? (v < 0 ? Graphics.Config._MIN_FLOAT : Graphics.Config._MAX_FLOAT) : v;
					} else if (typeof(v) == 'function') {
						v = v.call(this, this.attr(x, void 0, ns));
					} else if (Graphics.Api.isColor(v)) {
						v = Graphics.Api.toHexColor(v);
					} else {
						v = String(v);
					}
					/* set */
					if (typeof(ns) == 'string'){
						this.dom.setAttributeNS(ns, x, v)
					} else if (Graphics.VML.supported && (x in this.dom || Graphics.Config.specialAttrs[x])) {
						this.dom[Graphics.Config.specialAttrs[x] || x] = v;
					} else {
						this.dom.setAttribute(x, v);
					}
				}
				return this;
			},
			parent: function(x){
				if (!this.dom.parentNode) {
					return null;
				}
				var parent = Graphics.Api.adorn(this.dom.parentNode);
				if (!x) {
					return parent;
				}
				while (parent) {
					if (parent.is(x)) {
						return parent;
					}
					parent = Graphics.Api.adorn(parent.dom.parentNode);
				}
			},
			children: function(x, deep){
				for (var children = [], n = this.dom.childNodes, i = 0, t = typeof(x); i < n.length; i++) {
					if (x === void 0 || (t == 'string' ? Graphics.Api.matches(n[i], x) : (n[i] instanceof x || (t == 'function' && x.call(this, n[i], i, n))))) {
						children.push(Graphics.Api.adorn(n[i]));
					}
					if (deep === true && n[i].hasChildNodes()) {
						children = children.concat(Graphics.Api.adorn(n[i]).children(x, deep));
					}
				}
				return children;
			},
			x: function(x){
				return this.attr('x', x);
			},
			y: function(y){
				return this.attr('y', y);
			},
			width: function(width){
				return this.attr('width', width);
			},
			height: function(height){
				return this.attr('height', height);
			},
			size: function(width, height){
				return this.width(width).height(height);
			},
			data: function(x, v){
				if (x == null) {
					return this.json;
				} else if (typeof(x) == 'object') {
					this.json = x;
				} else if (typeof(x) == 'string' && v === void 0) {
					return this.json[x];
				} else if (typeof(x) == 'string' && v === null) {
					delete this.json[x];
				} else {
					this.json[x] = v;
				}
				return this;
			},
			domElement: function() {
				return this.dom;
			},
			root: function(){
				return this instanceof Graphics.DOMElement ? this : this.parent(Graphics.DOMElement);
			},
			move: function(x, y){
				return this.x(x).y(y);
			},
			center: function(x, y){
				return this.cx(x).cy(y);
			},
			is: function(x){
				return x && (typeof(x) == 'string' ? Graphics.Api.matches(this.dom, x) : this instanceof x);
			}
		}
	});

	Graphics.BBox = Graphics.create({
		create: function(elem){
			if (elem) {
				var box
				try {
					if (!document.documentElement.contains(elem.dom)) {
						throw 'Document contains no element';
					}
					box = elem.dom.getBBox();
				} catch(e) {
					box = { x: elem.dom.clientLeft, y: elem.dom.clientTop, width: elem.dom.clientWidth, height: elem.dom.clientHeight };
				}
				this.x = box.x
				this.y = box.y
				this.width  = box.width
				this.height = box.height
			}
			Graphics.Api.box(this);
		},
		parent: Graphics.Element,
		constructors: {
			bbox: function(){
				return new Graphics.BBox(this);
			}
		}
	});

	Graphics.Component = Graphics.create({
		superclass: Graphics.Element,
		create: function(elem){
			this.constructor.call(this, elem);
		},
		methods: {
			has: function(elem){
				return elem && this.index(elem) >= 0;
			},
			not: function(x){
				if (this instanceof Graphics.DOMElementList) {
					return this.filter(typeof(x) == 'string' ? function(item){ return Graphics.Api.matches(item.dom, x) } : x);
				} else {
					return (typeof(x) == 'string' ? Graphics.Api.matches(this.dom, x) : fn.call(this, this.dom)) ? this : new Graphics.VirtualDOM();
				}
			},
			index: function(elem){
				elem = elem === void 0 ? [this.dom.parentNode, this] : [this.dom, elem];
				return Array.prototype.slice.call(elem[0].childNodes).indexOf(elem[1].dom);
			},
			get: function(i){
				return Graphics.Api.adorn(this.dom.childNodes[i]);
			},
			first: function(){
				return this.get(0);
			},
			last: function(){
				return this.get(this.dom.childNodes.length - 1);
			},
			remove: function(){
				this.dom.parentNode.removeChild(this.dom);
			}
		}
	});

	Graphics.Shape = Graphics.create({
		superclass: Graphics.Element,
		create: function(elem){
			this.constructor.call(this, elem);
		},
		methods: {
		}
	});

	Graphics.Container = Graphics.create({
		superclass: Graphics.Component,
		create: function(elem){
			this.constructor.call(this, elem);
		},
		methods: {
			add: function(elem, i) {
				if (i == null) {
					this.dom.appendChild(elem.dom)
				} else if (elem.dom != this.dom.childNodes[i]) {
					this.dom.insertBefore(elem.dom, this.dom.childNodes[i])
				}
				return this;
			},
			put: function(elem, i){
				this.add(elem, i);
				return elem;
			},
			empty: function(){
				while(this.dom.hasChildNodes()) {
					this.dom.removeChild(this.dom.lastChild);
				}
				return this;
			},
			updateUI: function(){
				return this;
			}
		}
	});

	if (Graphics.VML.supported){
		if (!Array.prototype.forEach) {
			Array.prototype.forEach = function(fn) {
				if (typeof(fn) != 'function') {
					throw new TypeError();
				}
				for (var i = 0, j = this.length; i < j; i++) {
					if (fn.call(arguments[1], this[i], i, this) === false) {
						break;
					}
				}
			};
		}
		if (!Array.prototype.filter) {
			Array.prototype.filter = function(fn){
				if (typeof(fn) != 'function') {
					throw new TypeError();
				}
				for (var i = 0, j = this.length, arr = []; i < j; i++) {
					if (fn.call(arguments[1], this[i], i, this) === true) {
						arr.push(this[i]);
					}
				}
				return arr;
			};
		}
		if (!Array.prototype.indexOf) {
			Array.prototype.indexOf = function(search, from){
				for (var i = parseInt(from) || 0, j = this.length; i < j; i++) {
					if (this[i] === search) {
						return i;
					}
				}
				return -1;
			};
		}
		if (!document.querySelectorAll) {
			(function(d, s){
				s = d.createStyleSheet();
				d.querySelectorAll = function(selector){
					var x = [];
					d._qsa = x;
					s.addRule(selector, 'x1:polyfill;x2:expression(document._qsa.push(this))', 0);
					if (!d._qsa.length) {
						for (var i = 0, a = d.all, l = a.length; i < l; i++) {
							a[i].currentStyle.x1 === 'polyfill' && x.push(a[i]);
						}
					}
					s.removeRule(0);
					d._qsa = null;
					return x;
				};
				d.querySelector = function(selector){
					return d.querySelectorAll(selector)[0] || null;
				};
			})(document);
		}
		Graphics.extend(Graphics.Painter = Graphics.VML, {
			create: function(name){
				var elem = document.createElement('v:' + name);
				elem.id = Graphics.Api.gid(name);
				return elem;
			},
			Nested: Graphics.create({
				create: function(name){
					this.constructor.call(this, document.createElement(name));
					this.dom.id = Graphics.Api.gid(name);
				},
				superclass: Graphics.Container,
				constructors: {
					nested: function(name){
						return this.put(new Graphics.VML.Nested(name || 'div'));
					},
					updateUI: function(){
						var width = parseFloat(this.css('width')), height = parseFloat(this.css('height')), g = this.first();
						if (width && height && g) {
							g.children('roundrect').forEach(function(item){ item.css({ width: width + 'px', height: height + 'px' }) });
						}
						return this;
					}
				}
			}),
			G: Graphics.create({
				create: function(){
					this.constructor.call(this, document.createElement('div'));
					this.dom.id = Graphics.Api.gid('div');
				},
				superclass: Graphics.Container,
				constructors: {
					g: function(){
						return this.put(new Graphics.VML.G).size('100%', '100%');
					}
				}
			}),
			Fill: Graphics.create({
				create: 'fill',
				superclass: Graphics.Container,
				constructors: {
					fill: function(attrs){
						var defaults = { type: 'gradient', method: 'linear', color: 'black', angle: 45 };
						Graphics.extend(defaults, attrs);
						this.put(new Graphics.VML.Fill).attr(defaults);
						return this;
					}
				}
			}),
			Stroke: Graphics.create({
				create: 'stroke',
				superclass: Graphics.Container,
				constructors: {
					stroke: function(attrs){
						var defaults = { color: 'black', weight: 1.2 };
						Graphics.extend(defaults, attrs);
						this.put(new Graphics.VML.Stroke).attr(defaults);
						return this;
					}
				}
			}),
			Shadow: Graphics.create({
				create: 'shadow',
				superclass: Graphics.Container,
				constructors: {
					shadow: function(attrs){
						var defaults = { on: true, offset: '2px,2px' };
						Graphics.extend(defaults, attrs);
						this.put(new Graphics.VML.Shadow).attr(defaults);
						return this;
					}
				}
			}),
			ShapeType: Graphics.create({
				create: 'shapetype',
				superclass: Graphics.Container,
				constructors: {
					shapetype: function(){
						return this.put(new Graphics.VML.ShapeType);
					}
				}
			}),
			Use: Graphics.create({
				create: 'shape',
				superclass: Graphics.Container,
				constructors: {
					use: function(idRef, file){
						return this.put(new Graphics.VML.Use).href(idRef);
					}
				},
				methods: {
					href: function(idRef){
						this.dom.type = '#' + idRef;
						return this;
					}
				}
			}),
			Rect: Graphics.create({
				create: 'roundrect',
				superclass: Graphics.Container,
				constructors: {
					rect: function(width, height){
						return this.put(new Graphics.VML.Rect()).size(width, height);
					}
				}
			}),
			Circle: Graphics.create({
				create: 'oval',
				superclass: Graphics.Container,
				constructors: {
					circle: function(width, height){
						return this.put(new Graphics.VML.Circle).size(width, height);
					}
				}
			}),
			Rhombus: Graphics.create({
				create: function(width, height){
					this._width = width;
					this._height = height;
					this.constructor.call(this, Graphics.VML.create('polyline'));
				},
				superclass: Graphics.Container,
				constructors: {
					rhombus: function(width, height){
						return this.put(new Graphics.VML.Rhombus(width, height)).move(0, 0);
					}
				},
				methods: {
					move: function(x, y){
						var w = this._width / 2, h = this._height / 2;
						this.dom.points.value = [x, y + h, x + w, y + this._height, x + this._width, y + h, x + w, y, x, y + h].join(',');
						return this;
					}
				}
			}),
			Image: Graphics.create({
				create: function(){
					this.constructor.call(this, document.createElement('img'));
				},
				superclass: Graphics.Container,
				constructors: {
					image: function(uri){
						return this.put(new Graphics.VML.Image).href(uri).css('position', 'absolute');
					}
				},
				methods: {
					href: function(uri){
						return uri === void 0 ? this.attr('src') : this.attr('src', uri);
					}
				}
			}),
			Path: Graphics.create({
				create: 'path',
				superclass: Graphics.Container,
				constructors: {
					path: function(v){
						return this.put(new Graphics.VML.Path).v(v);
					}
				},
				methods: {
					v: function(v){
						switch (Graphics.Api.type(v)) {
						case '[object Undefined]':
							return this.attr('v');
						case '[object String]':
							return this.attr('v', v);
						case '[object Array]':
							return this.attr('v', v.join(','));
						default:
							return this;
						}
					}
				}
			}),
			Polyline: Graphics.create({
				create: 'polyline',
				superclass: Graphics.Container,
				constructors: {
					polyline: function(points){
						return this.put(new Graphics.VML.Polyline).points(points);
					}
				},
				methods: {
					points: function(points){
						switch (Graphics.Api.type(points)) {
						case '[object Undefined]':
							points = Graphics.Api.trimAndSplit(this.attr('fromTo') || this.dom.points.value, ',');
							points.forEach(function(item, i){ points[i] = /pt$/i.test(item) ? Graphics.Api.toPx(item) : Number(item) });
							return points;
						case '[object Array]':
							points = points.join(',');
						case '[object String]':
							this.dom.points.value = points;
						default:
							return this;
						}
					},
					cpoint: function(start){
						var points = this.points();
						start = Number(start) || (points.length > 4 ? 2 : 0);
						return [ (points[start] + points[start + 2]) / 2, (points[start + 1] + points[start + 3]) / 2 ];
					}
				}
			}),
			Line: Graphics.create({
				create: 'line',
				superclass: Graphics.Container,
				constructors: {
					line: function(x1, y1, x2, y2){
						return this.put(new Graphics.VML.Line).from(x1, y1).to(x2, y2);
					}
				},
				methods: {
					fromTo: function(){
						var xy = { x: 0, y: 0}, from = this.attr('from') || xy, to = this.attr('to') || xy;
						return [ Graphics.Api.toPx(from.x), Graphics.Api.toPx(from.y), Graphics.Api.toPx(to.x), Graphics.Api.toPx(to.y) ];
					},
					from: function(x, y){
						return this.attr('from', x + ' ' + y);
					},
					to: function(x, y){
						return this.attr('to', x + ' ' + y);
					},
					cpoint: function(){
						var fromTo = this.fromTo();
						return [ (fromTo[0] + fromTo[2]) / 2, (fromTo[1] + fromTo[3]) / 2 ];
					}
				}
			}),
			Text: Graphics.create({
				create: function(leading, aligning, fillBG){
					this._fillBG = fillBG === true;
					this.aligning(aligning || Graphics.Config.defaultAttrs.aligning);
					this.constructor.call(this, document.createElement('label'));
				},
				superclass: Graphics.Container,
				constructors: {
					text: function(text, leading, aligning, fillBG){
						return this.put(new Graphics.VML.Text(leading, aligning, fillBG)).css({ position: 'absolute', display: 'block', cursor: 'text' }).text(text);
					}
				},
				methods: {
					text: function(text){
						if (text === void 0) {
							return this.dom.innerHTML;
						} else {
							this.empty().dom.innerHTML = text;
							return this.updateUI();
						}
					},
					x: function(x){
						return x === void 0 ? this.dom.offsetLeft : this.x(x).updateUI();
					},
					y: function(y){
						return x === void 0 ? this.dom.offsetTop : this.y(y).updateUI();
					},
					size: function(size){
						return this.attr('font-size', size).updateUI();
					},
					aligning: function(aligning){
						if (aligning === void 0) {
							return this._aligning;
						} else {
							var setter = function(s){
								this._aligning = [];
								for (var exp = new RegExp('[xy]M[ia][ndx]|x(left|right)|y(top|bottom)', 'ig'), rs; (rs = exp.exec(s)) != null;) {
									this._aligning.push(rs[0]);
								}
								return this._aligning.length;
							};
							setter.call(this, aligning) != 2 && setter.call(this, Graphics.Config.defaultAttrs.aligning);
							return this.updateUI();
						}
					},
					updateUI: function(){
						if (this.dom && this.text()) {
							var x = 0, y = 0, parent = this.parent('div'), bbox = this.bbox();
							/* fill relative pos */
							if (!(parent instanceof Graphics.DOMElement)) {
								parent.children('line,polyline').forEach(function(item){
									var cpoint = item.cpoint && item.cpoint();
									if (cpoint) {
										x = cpoint[0] - bbox.width / 2;
										y = cpoint[1] - bbox.height / 2;
										return false;
									}
								}, this);
								if (x || y) {
									return this.css({ left: x + 'px', top: y + 'px' });
								}
							}
							if (/xMin/i.test(this._aligning[0])) {
								this.css('left', '0px');
							} else if (/xMid/i.test(this._aligning[0])) {
								this.css('left', (this.parent().bbox().width / 2 - bbox.width / 2) + 'px');
							} else if (/xMax/i.test(this._aligning[0])) {
								this.css('right', '0px');
							} else if (/xLeft/i.test(this._aligning[0])) {
								this.css('left', (0 - bbox.width) + 'px');
							} else if (/xRight/i.test(this._aligning[0])) {
								this.css('right', (0 - bbox.width) + 'px');
							}
							if (/yMin/i.test(this._aligning[1])) {
								this.css('top', '0%');
							} else if (/yMid/i.test(this._aligning[1])) {
								this.css('top', (this.parent().bbox().height / 2 - bbox.height / 2) + 'px');
							} else if (/yMax/i.test(this._aligning[1])) {
								this.css('bottom', '0px');
							} else if (/yTop/i.test(this._aligning[1])) {
								this.css('top', (0 - bbox.height) + 'px');
							} else if (/yBottom/i.test(this._aligning[1])) {
								this.css('bottom', (0 - bbox.height) + 'px');
							}
							if (this._fillBG) {
								this.css({ border: '1px red dashed', 'background-color': '#FFFAF0', padding: '2px 10px' });
							}
						}
						return this;
					}
				}
			})
		});

		Graphics.extend(Graphics.Element, {
			x: function(x){
				return this.css('left', typeof(x) == 'string' ? x : x + 'px');
			},
			y: function(y){
				return this.css('top', typeof(y) == 'string' ? y : y + 'px');
			},
			width: function(width){
				width = typeof(width) == 'string' ? width : width + 'px';
				return this.css('width', width).updateUI();
			},
			height: function(height){
				height = typeof(height) == 'string' ? height : height + 'px';
				return this.css('height', height).updateUI();
			}
		});

		Graphics.extend(Graphics.Container, {
			namespace: function(){
				return this;
			},
			templates: function(){
				if (!this._defs) {
					var defs = this.children('div.defs');
					if (defs.length) {
						this._defs = defs[0];
					} else {
						this._defs = this.nested().addClass('defs');
					}
				}
				return this._defs;
			}
		});

	} else {
		Graphics.extend(Graphics.Painter = Graphics.SVG, {
			create: function(name){
				var elem = document.createElementNS(Graphics.SVG.ns, name);
				elem.setAttribute('id', Graphics.Api.gid(name));
				return elem;
			},
			Defs: Graphics.create({
				create: 'defs',
				superclass: Graphics.Container,
				methods: {
					gradient: function(type) {
						return this.put(new Graphics.SVG.Gradient(type));
					}
				}
			}),
			G: Graphics.create({
				create: 'g',
				superclass: Graphics.Container,
				constructors: {
					g: function(){
						return this.put(new Graphics.SVG.G);
					}
				}
			}),
			Nested: Graphics.create({
				create: 'svg',
				superclass: Graphics.Container,
				constructors: {
					nested: function(){
						return this.put(new Graphics.SVG.Nested).css('overflow', 'visible');
					}
				},
				methods: {
				}
			}),
			Symbol: Graphics.create({
				create: 'symbol',
				superclass: Graphics.Container,
				constructors: {
					symbol: function(x, y, width, height){
						return this.put(new Graphics.SVG.Symbol).attr('viewBox', x + ' ' + y + ' ' + width + ' ' + height);
					}
				}
			}),
			Arrow: Graphics.create({
				create: function(){
					this.constructor.call(this, Graphics.SVG.create('marker'));
				},
				superclass: Graphics.Container,
				constructors: {
					arrow: function(id){
						return this.templates().put(new Graphics.SVG.Arrow).attr({ id: id, viewBox: '0 0 10 10', refX: 10, refY: 5, markerUnits: 'strokeWidth', markerWidth: 10, markerHeight: 10, orient: 'auto' }).path('M 0 0 L 10 5 L 0 10').css('stroke-width', 1.1);
					}
				}
			}),
			Rhombus: Graphics.create({
				create: function(){
					this.constructor.call(this, Graphics.SVG.create('polygon'));
				},
				superclass: Graphics.Shape,
				constructors: {
					rhombus: function(width, height){
						return this.put(new Graphics.SVG.Rhombus).size(width, height).move(0, 0);
					}
				},
				methods: {
					move: function(x, y){
						var w = this.attr('width') / 2, h = this.attr('height') / 2;
						return this.attr('points', [x += w, y, x + w, y + h, x, y + h * 2, x - w, y + h].join(','));
					}
				}
			}),
			Use: Graphics.create({
				create: 'use',
				superclass: Graphics.Shape,
				constructors: {
					use: function(idRef, file){
						return this.put(new Graphics.SVG.Use).href(idRef, file);
					}
				},
				methods: {
					href: function(idRef, file){
						return this.attr('href', (file || '') + '#' + idRef, Graphics.SVG.xlink);
					}
				}
			}),
			Gradient: Graphics.create({
				create: function(type){
					this.constructor.call(this, Graphics.SVG.create(type + 'Gradient'));
					this.type = type
				},
				superclass: Graphics.Container,
				constructors: {
					gradient: function(type) {
						return this.templates().gradient(type)
					}
				},
				methods: {
					stop: function(offset, style) {
						this.put(new Graphics.Shape(Graphics.SVG.create('stop'))).attr({ offset: offset, style: style });
						return this;
					}
				}
			}),
			Rect: Graphics.create({
				create: 'rect',
				superclass: Graphics.Shape,
				constructors: {
					rect: function(width, height){
						return this.put(new Graphics.SVG.Rect).size(width, height).rx(4).ry(4);
					}
				},
				methods: {
					rx: function(rx){
						return this.attr('rx', rx);
					},
					ry: function(ry){
						return this.attr('ry', ry);
					}
				}
			}),
			Circle: Graphics.create({
				create: 'circle',
				superclass: Graphics.Shape,
				constructors: {
					circle: function(size){
						return this.put(new Graphics.SVG.Circle).rx(size / 2);
					}
				},
				methods: {
					x: function(x){
						return x === void 0 ? this.cx() - this.rx() : this.cx(x + this.rx());
					},
					y: function(y){
						return y === void 0 ? this.cy() - this.ry() : this.cy(y + this.ry());
					},
					rx: function(rx){
						return this.attr('r', rx);
					},
					ry: function(ry){
						return this.rx(ry);
					},
					cx: function(cx){
						return cx === void 0 ? this.attr('cx') : this.attr('cx', cx);
					},
					cy: function(cy){
						return cy === void 0 ? this.attr('cy') : this.attr('cy', cy);
					},
					width: function(width){
						return width === void 0 ? this.rx() * 2 : this.rx(width / 2);
					},
					height: function(height){
						return height === void 0 ? this.ry() * 2 : this.ry(width / 2);
					},
					size: function(width, height){
						return this.width(width).height(height);
					}
				}
			}),
			Path: Graphics.create({
				create: 'path',
				superclass: Graphics.Shape,
				constructors: {
					path: function(d){
						return this.put(new Graphics.SVG.Path).d(d);
					}
				},
				methods: {
					d: function(d){
						switch (Graphics.Api.type(d)) {
						case '[object Undefined]':
							return this.attr('d');
						case '[object String]':
							return this.attr('d', d);
						case '[object Array]':
							return this.attr('d', d.join(' '));
						default:
							return this;
						}
					}
				}
			}),
			Line: Graphics.create({
				create: 'line',
				superclass: Graphics.Shape,
				constructors: {
					line: function(x1, y1, x2, y2){
						return this.put(new Graphics.SVG.Line).from(x1, y1).to(x2, y2);
					}
				},
				methods: {
					fromTo: function(){
						return [ this.attr('x1'), this.attr('y1'), this.attr('x2'), this.attr('y2') ];
					},
					from: function(x, y){
						return this.attr({ x1: x, y1: y });
					},
					to: function(x, y){
						return this.attr({ x2: x, y2: y });
					},
					cpoint: function(){
						return [ (this.attr('x1') + this.attr('x2')) / 2, (this.attr('y1') + this.attr('y2')) / 2 ];
					}
				}
			}),
			Polyline: Graphics.create({
				create: 'polyline',
				superclass: Graphics.Shape,
				constructors: {
					polyline: function(points){
						return this.put(new Graphics.SVG.Polyline).points(points);
					}
				},
				methods: {
					points: function(x){
						switch (Graphics.Api.type(x)) {
						case '[object Undefined]':
							x = Graphics.Api.trimAndSplit(this.attr('points'), /,|\s+/);
							x.forEach(function(item, i){ x[i] = Number(item) });
							return x;
						case '[object String]':
							x = Graphics.Api.trimAndSplit(x, ',');
						case '[object Array]':
							return this.attr('points', x.join(' '));
						default:
							return this;
						}
					},
					cpoint: function(start){
						var points = this.points();
						start = Number(start) || (points.length > 4 ? 2 : 0);
						return [ (points[start] + points[start + 2]) / 2, (points[start + 1] + points[start + 3]) / 2 ];
					}
				}
			}),
			Image: Graphics.create({
				create: 'image',
				superclass: Graphics.Shape,
				constructors: {
					image: function(uri, width, height){
						return this.put(new Graphics.SVG.Image).attr('href', uri, Graphics.SVG.xlink).size(width || 0, height || 0);
					}
				}
			}),
			Text: Graphics.create({
				create: function(leading, aligning, fillBG){
					this._fillBG = fillBG === true;
					this.leading(leading || Graphics.Config.defaultAttrs.leading);
					this.aligning(aligning || Graphics.Config.defaultAttrs.aligning);
					this.constructor.call(this, Graphics.SVG.create('text'));
				},
				superclass: Graphics.Container,
				constructors: {
					text: function(text, leading, aligning, fillBG){
						return this.put(new Graphics.SVG.Text(leading, aligning, fillBG)).css({ fill: 'black', stroke: 'none', 'stroke-width': 1, 'font-size': Graphics.Config.defaultAttrs['font-size'], 'font-family': Graphics.Config.defaultAttrs['font-family'], cursor: 'text' }).text(text);
					}
				},
				methods: {
					text: function(text){
						if (text === void 0) {
							var text = '';
							this.children().forEach(function(item, index){
								if (index > 0) {
									text += '\n';
								}
								text += item.dom.textContent;
							});
							return text;
						} else {
							this.empty();
							text.split('\n').forEach(function(item){
								var tspan = new Graphics.SVG.Tspan;
								this.dom.appendChild(tspan.dom);
								tspan.text(item);
							}, this);
							return this.updateUI();
						}
					},
					x: function(x){
						return x === void 0 ? this.attr('x') : this.attr('x', x).updateUI();
					},
					y: function(y){
						var oy = this.attr('y'), o  = typeof(oy) == 'number' ? oy - this.bbox().y : 0;
						if (y === void 0) {
							return typeof(oy) == 'number' ? oy - o : oy;
						}
						return this.attr('y', typeof(y) == 'number' ? y + o : y);
					},
					size: function(size){
						return this.css('font-size', size).updateUI();
					},
					family: function(family){
						return this.css('font-family', family).updateUI();
					},
					leading: function(leading) {
						if (leading === void 0) {
							return this._leading;
						} else {
							this._leading = isNaN(leading) ? Graphics.Config.defaultAttrs.leading : leading;
							return this.updateUI();
						}
					},
					aligning: function(aligning){
						if (aligning === void 0) {
							return this._aligning;
						} else {
							var setter = function(s){
								this._aligning = [];
								for (var exp = new RegExp('[xy]M[ia][ndx]|x(left|right)|y(top|bottom)', 'ig'), rs; (rs = exp.exec(s)) != null;) {
									this._aligning.push(rs[0]);
								}
								return this._aligning.length;
							};
							setter.call(this, aligning) != 2 && setter.call(this, Graphics.Config.defaultAttrs.aligning);
							return this.updateUI();
						}
					},
					updateUI: function(){
						if (this.dom && this.text()) {
							var dy = this._leading * parseFloat(this.css('font-size')), incr = 0, x = 0, y = 0, children = this.children(SVGElement), parent = this.parent('svg');
							/* fill relative pos */
							if (!(parent instanceof Graphics.DOMElement) && parent.x() === 0) {
								parent.children('line,polyline').forEach(function(item){
									var cpoint = item.cpoint();
									x = cpoint[0];
									y = cpoint[1] - this.bbox().height / 2;
									return false;
								}, this);
								if (x || y) {
									children.forEach(function(item){ item.attr('x', x) });
									return this.css('text-anchor', 'middle').attr('x', x).y(y);
								}
							}
							children.forEach(function(item, i){
								if (item.attr('x', 0).dom.textContent == '\n') {
									incr += dy;
								} else {
									item.attr('dy', dy + incr);
									incr = 0;
								}
							});
							var bbox1 = parent.bbox(), bbox2 = this.bbox();
							if (/xMin/i.test(this._aligning[0])) {
								this.css('text-anchor', 'start');
							} else if (/xMid/i.test(this._aligning[0])) {
								this.css('text-anchor', 'middle');
								x = bbox1.x2 / 2;
							} else if (/xMax/i.test(this._aligning[0])) {
								this.css('text-anchor', 'end');
								x = bbox1.x2;
							} else if (/xLeft/i.test(this._aligning[0])) {
								this.css('text-anchor', 'end');
								x = 0;
							} else if (/xRight/i.test(this._aligning[0])) {
								this.css('text-anchor', 'start');
								x = bbox1.x2;
							}
							if (/yMin/i.test(this._aligning[1])) {
								/* NO-OP */
							} else if (/yMid/i.test(this._aligning[1])) {
								y = parent.attr('height') / 2 - bbox2.height / 2;
							} else if (/yMax/i.test(this._aligning[1])) {
								y = parent.attr('height') - bbox2.height;
							} else if (/yTop/i.test(this._aligning[1])) {
								y = 0 - bbox2.height;
							} else if (/yBottom/i.test(this._aligning[1])) {
								y = parent.attr('height');
							}
							children.forEach(function(item){ item.attr('x', x) });
							this.attr('x', x).y(y);
							if (this._fillBG) {
								if (!this._bg) {
									this._bg = this.parent().put(new Graphics.SVG.Rect, 1).rx(0).ry(0).css({ strokeDasharray: '5,5', strokeWidth: '1px' });
								}
								this._bg.size(bbox2.width + 10, bbox2.height + 10).move(x - 4, y - 4);
							}
						}
						return this;
					}
				}
			}),
			Tspan: Graphics.create({
				create: 'tspan',
				superclass: Graphics.Shape,
				constructors: {
					tspan: function(text){
						return this.put(new Graphics.SVG.Tspan).text(text);
					}
				},
				methods: {
					plain: function(text){
						this.dom.appendChild(document.createTextNode(text));
						return this;
					},
					text: function(text) {
						if (text === void 0) {
							return this.dom.textContent;
						}
						typeof(text) == 'function' ? text.call(this, this.dom.textContent) : this.plain(text);
						return this;
					},
					dx: function(dx){
						return this.attr('dx', dx);
					},
					dy: function(dy){
						return this.attr('dy', dy);
					}
				}
			})
		});

		Graphics.extend(Graphics.Container, {
			namespace: function(){
				this.attr('version', '1.1').attr('xmlns:xlink', Graphics.SVG.xlink, Graphics.SVG.xmlns).attr('xmlns:esvg', Graphics.SVG.esvg, Graphics.SVG.xmlns);
				/* FIX MSIE */
				if (this.dom.parentNode.innerHTML.indexOf('xmlns') === -1) {
					this.attr('xmlns', Graphics.SVG.ns);
				}
				return this;
			},
			templates: function(){
				if (!this._defs) {
					var defs = this.children('defs');
					if (defs.length) {
						this._defs = defs[0];
					} else {
						this._defs = new Graphics.SVG.Defs
						this.dom.appendChild(this._defs.dom);
					}
				}
				return this._defs;
			}
		});
	}

	Graphics.DOMElement = Graphics.create({
		superclass: Graphics.Container,
		create: function(elem){
			if (elem) {
				elem = typeof(elem) == 'string' ? document.getElementById(elem) : (Graphics.Api.isJQueryObject(elem) ? elem[0] : elem);
				if (new RegExp(Graphics.Painter.tag, 'i').test(elem.nodeName)) {
					this.constructor.call(this, elem);
				} else {
					this.constructor.call(this,	Graphics.Painter.create(Graphics.Painter.tag));
					elem.appendChild(this.dom);
				}
				this.namespace().templates();
			}
		},
		methods: {
			parent: function(){
				return this.dom.parentNode.nodeName == '#document' ? null : this.dom.parentNode;
			}
		}
	});

	Graphics.DOMElementList = Graphics.create({
		superclass: Graphics.DOMElement,
		create: function(srcElement, elements){
			this._srcElement = srcElement;
			this._elements = elements;
			this._delegate();
			return this;
		},
		methods: {
			_delegate: function(fn){
				var i, v = typeof(fn) == 'function' ? fn.apply(this._elements, arguments.callee.caller.arguments) : null;
				if (this.length !== this._elements.length) {
					for (i = (this.length || 0) - 1; i >= 0; i--) {
						this[i] && delete this[i];
					}
					this.length = this._elements.length;
				}
				for (i = 0; i < this.length; i++) {
					this[i] = this._elements[i];
				}
				return v;
			},
			end: new Function('return this._srcElement'),
			toString: new Function('return this._delegate(Array.prototype.toString)'),
			toLocaleString: new Function('return this._delegate(Array.prototype.toLocaleString)'),
			join: new Function('return this._delegate(Array.prototype.join)'),
			pop: new Function('return this._delegate(Array.prototype.pop)'),
			push: new Function('return this._delegate(Array.prototype.push)'),
			reverse: new Function('return this._delegate(Array.prototype.reverse)'),
			shift: new Function('return this._delegate(Array.prototype.shift)'),
			unshift: new Function('return this._delegate(Array.prototype.unshift)'),
			slice: new Function('return this._delegate(Array.prototype.slice)'),
			splice: new Function('return this._delegate(Array.prototype.splice)'),
			sort: new Function('return this._delegate(Array.prototype.sort)'),
			filter: new Function('return this._delegate(Array.prototype.filter)'),
			forEach: new Function('return this._delegate(Array.prototype.forEach)'),
			some: new Function('return this._delegate(Array.prototype.some)'),
			every: new Function('return this._delegate(Array.prototype.every)'),
			map: new Function('return this._delegate(Array.prototype.map)'),
			indexOf: new Function('return this._delegate(Array.prototype.indexOf)'),
			lastIndexOf: new Function('return this._delegate(Array.prototype.lastIndexOf)'),
			reduce: new Function('return this._delegate(Array.prototype.reduce)'),
			reduceRight: new Function('return this._delegate(Array.prototype.reduceRight)'),
			copyWithin: new Function('return this._delegate(Array.prototype.copyWithin)'),
			find: new Function('return this._delegate(Array.prototype.find)'),
			findIndex: new Function('return this._delegate(Array.prototype.findIndex)'),
			fill: new Function('return this._delegate(Array.prototype.fill)'),
			includes: new Function('return this._delegate(Array.prototype.includes)'),
			entries: new Function('return this._delegate(Array.prototype.entries)'),
			keys: new Function('return this._delegate(Array.prototype.keys)'),
			concat: new Function('return this._delegate(Array.prototype.concat)')
		}
	});

	Graphics.VirtualDOM = Graphics.create({
		superclass: Graphics.DOMElement,
		create: function(){
			return this;
		}
	});

	return Graphics;
}));
