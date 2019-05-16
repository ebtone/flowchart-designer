/**
 * Flowchart UI
 */
(function($){
	var XLINE = 'xline';
	var stringFormat = String.prototype.format || function() {
		var value = this;
		for (var i = 0; i < arguments.length; i++) {
			value = value.replace(new RegExp('{\\s*' + i + '\\s*}', 'g'), arguments[i]);
		}
		return value;
	};

	function getScrollbarWidth() {
		var scrollbarWidth = window._scrollbarWidth;
		if (!scrollbarWidth) {
			if (Graphics.Config.browser.msie) {
				var $textarea1 = $('<textarea cols="10" rows="2" style="position:absolute;top:-1000;left:-1000;">').appendTo('body');
				var $textarea2 = $('<textarea cols="10" rows="2" style="position:absolute;top:-1000;left:-1000;overflow:hidden;">').appendTo('body');
				window._scrollbarWidth = scrollbarWidth = $textarea1.width() - $textarea2.width();
				$textarea1.add($textarea2).remove();
			} else {
				var $div = $('<div style="width:100px;height:100px;overflow:auto;position:absolute;top:-1000;left:-1000;"/>').prependTo('body').append('<div>').find('div').css({ width: '100%', height: 200 });
				window._scrollbarWidth = scrollbarWidth = 100 - $div.width();
				$div.parent().remove();
			}
		}
        return scrollbarWidth;
    };

	function getElementBorderDimension(elem) {
		return { borderWidth: ($(elem).outerWidth() - $(elem).innerWidth()), borderHeight: ($(elem).outerHeight() - $(elem).innerHeight()) };
	};

	function getElementGap(elem) {
		var jq = $(elem);
		return {
			top: parseFloat('0' + jq.css('border-top-width')) ? parseFloat('0' + jq.css('margin-top')) : parseFloat('0' + jq.css('margin-top')) + parseFloat('0' + jq.css('padding-top')),
			right: parseFloat('0' + jq.css('border-right-width')) ? parseFloat('0' + jq.css('margin-right')) : parseFloat('0' + jq.css('margin-right')) + parseFloat('0' + jq.css('padding-right')),
			bottom: parseFloat('0' + jq.css('border-bottom-width')) ? parseFloat('0' + jq.css('margin-bottom')) : parseFloat('0' + jq.css('margin-bottom')) + parseFloat('0' + jq.css('padding-bottom')),
			left: parseFloat('0' + jq.css('border-left-width')) ? parseFloat('0' + jq.css('margin-left')) : parseFloat('0' + jq.css('margin-left')) + parseFloat('0' + jq.css('padding-left'))
		};
	};

	function getMousePosition(event) {
		var pos = { offsetX: event.offsetX, offsetY: event.offsetY };
		if (event.pageX || event.pageY){
			pos.x = event.pageX;
			pos.y = event.pageY;
		} else {
			var doc = document.documentElement, body = document.body;
			pos.x = event.clientX + (doc && doc.scrollLeft || body && body.scrollLeft || 0) - (doc && doc.clientLeft || body && body.clientLeft || 0);
			pos.y = event.clientY + (doc && doc.scrollTop || body && body.scrollTop || 0) - (doc && doc.clientTop || body && body.clientTop || 0);
		}
		return pos;
	};

	function autoSize(jq, options) {
		var doc = document.documentElement,
			body = document.body,
			maxWidth = (doc && doc.clientWidth || body && body.clientWidth || 0) - ($(doc).outerWidth(true) - $(doc).outerWidth() || $(body).outerWidth(true) - $(body).outerWidth()),
			maxHeight = (doc && doc.clientHeight || body && body.clientHeight || 0) - ($(doc).outerHeight(true) - $(doc).outerHeight() || $(body).outerHeight(true) - $(body).outerHeight()),
			width = options.width || $.fn.flowchart.defaults.width,
			height = options.height || $.fn.flowchart.defaults.height,
			exp = /^(auto|([0-9]{1,2}|100)%)$/ig;
		options.uiWidth = typeof(width) == 'string' ? (exp.test(width) && parseFloat(RegExp.$1) || 100) / 100 * maxWidth : width;
		options.uiHeight = typeof(height) == 'string' ? (exp.test(height) && parseFloat(RegExp.$1) || 100) / 100 * maxHeight : height;
		options.uiWidth -= jq.outerWidth(true) - jq.width();
		options.uiHeight -= jq.outerHeight(true) - jq.height();
	};

	function pushUndoStack(fn, data) {
		var options = $.data(arguments.callee.caller.arguments[1], 'flowchart').options;
		if (options.buffer.redoing) {
			if (options.buffer.redo.push([fn, data]) > options.undoStackSize) {
				options.buffer.redo.shift();
			}
		} else {
			if (options.buffer.undo.push([fn, data]) > options.undoStackSize) {
				options.buffer.undo.shift();
			}
			if (typeof(options.buffer.redoing) == 'undefined') {
				options.buffer.redo.length = 0;
			}
		}
		options.buffer.redoing = undefined;
	};

	function undo(jq, params) {
		var options = jq.data('flowchart').options;
		options.buffer.redoing = 1;
		options.buffer.undo.length && jq.flowchart.apply(jq, options.buffer.undo.pop());
	};

	function redo(jq, params) {
		var options = jq.data('flowchart').options;
		options.buffer.redoing = 0;
		options.buffer.redo.length && jq.flowchart.apply(jq, options.buffer.redo.pop());
	};

	function hash(data) {
		return data.id + ',' + data.top + ',' + data.left + ',' + data.width + ',' + data.height;
	};

	function mask(jq, options) {
		unmask(jq);
		var width = jq.outerWidth(), height = jq.outerHeight(), span = $('<span>').text(options.lang['loading.message']);
		$('<div class="flowchart-blockUI"><div></div></div>').appendTo(jq).css($.extend(jq.offset(), { width: width, height: height, 'line-height': height + 'px' })).append(span).show();
		span.css('left', width / 2 - span.outerWidth(true) / 2);
	};

   	function unmask(jq) {
		jq.children('div.flowchart-blockUI').remove();
	};

	function doResizing(jq, options, event, data, kind, minWidth, minHeight) {
		var that = Graphics.Api.adorn(event.target), cursor = that.css('cursor'), mousePos = getMousePosition(event), elemPos = Graphics.Api.coordinate(options.ui.canvas[0]), bd = getElementBorderDimension(options.ui.snapshot), thatPos = that.position('#' + data.id), x1 = mousePos.x - thatPos.left, y1 = mousePos.y - thatPos.top, moved = 0;
		options.ui.snapshot.css({ display: 'block', cursor: cursor, width: data.width, height: data.height, left: data.left + elemPos.left - options.ui.canvasCNTR.scrollLeft() + bd.borderWidth / 2, top: data.top + elemPos.top - options.ui.canvasCNTR.scrollTop() + bd.borderHeight / 2 });
		var so = options.ui.snapshot.offset(), sw = options.ui.snapshot.width(), sh = options.ui.snapshot.height();
		document.onmousemove = function(event){
			var _mousePos = getMousePosition(event || window.event), x2 = _mousePos.x - x1, y2 = _mousePos.y - y1, bbox = that.bbox();
			switch (cursor) {
			case 'e-resize':
				options.ui.snapshot.css('width', Math.max(bbox.width + x2, minWidth));
				break;
			case 's-resize':
				options.ui.snapshot.css('height', Math.max(bbox.height + y2, minHeight));
				break;
			case 'w-resize':
				var w1 = Math.max(sw - x2, minWidth);
				options.ui.snapshot.css({ left: so.left + (sw - x2 < minWidth ? data.width - w1 : x2), width: w1 });
				break;
			case 'n-resize':
				var h1 = Math.max(sh - y2, minHeight);
				options.ui.snapshot.css({ top: so.top + (sh - y2 < minHeight ? data.height - h1 : y2), height: h1 });
				break;
			case 'ne-resize':
				var w1 = Math.max(sw - x2, minWidth);
				options.ui.snapshot.css({ left: so.left + (sw - x2 < minWidth ? data.width - w1 : x2), width: w1, height: Math.max(bbox.height + y2, minHeight) });
				break;
			case 'nw-resize':
				options.ui.snapshot.css({ width: Math.max(bbox.width + x2, minWidth), height: Math.max(bbox.height + y2, minHeight) });
				break;
			case 'se-resize':
				var w1 = Math.max(sw - x2, minWidth), h1 = Math.max(sh - y2, minHeight);
				options.ui.snapshot.css({ left: so.left + (sw - x2 < minWidth ? data.width - w1 : x2), top: so.top + (sh - y2 < minHeight ? data.height - h1 : y2), width: w1, height: h1 });
				break;
			case 'sw-resize':
				var h1 = Math.max(sh - y2, minHeight);
				options.ui.snapshot.css({ top: so.top + (sh - y2 < minHeight ? data.height - h1 : y2), width: Math.max(bbox.width + x2, minWidth), height: h1 });
				break;
			}
			moved = 1;
		};
		document.onmouseup = function(event){
			options.ui.snapshot.empty().hide();
			document.onmouseup = document.onmousemove = null;
			if (moved) {
				jq.flowchart('resize', { id: data.id, kind: kind, left: parseFloat(options.ui.snapshot.css('left')) - elemPos.left + options.ui.canvasCNTR.scrollLeft() - bd.borderWidth / 2, top: parseFloat(options.ui.snapshot.css('top')) - elemPos.top + options.ui.canvasCNTR.scrollTop() - bd.borderHeight / 2, width: options.ui.snapshot.width(), height: options.ui.snapshot.height() });
			}
			return false;
		};
	};

	function doMoving(jq, options, event, data, kind) {
		var that = Graphics.Api.adorn(event.target), cursor = that.css('cursor'), mousePos = getMousePosition(event), elemPos = Graphics.Api.coordinate(options.ui.canvas[0]), bd = getElementBorderDimension(options.ui.snapshot);
		var x1 = mousePos.x - elemPos.left + options.ui.canvasCNTR.scrollLeft() - data.left, y1 = mousePos.y - elemPos.top + options.ui.canvasCNTR.scrollTop() - data.top, moved = 0;
		options.ui.snapshot.css({ cursor: cursor, width: data.width, height: data.height }).append(Graphics.Api.reassignId(document.getElementById(data.id).parentNode.cloneNode(true)));
		document.onmousemove = Graphics.Api.throttle(80, function(_event){
			var _mousePos = getMousePosition(_event || window.event), x2 = _mousePos.x - x1, y2 = _mousePos.y - y1, x3, y3, mpX, mpY, xLine, yLine;
			/* calculating */
			if (x2 < elemPos.left - options.ui.canvasCNTR.scrollLeft()) {
				x2 = elemPos.left - options.ui.canvasCNTR.scrollLeft();
			} else if (x2 + options.ui.canvasCNTR.scrollLeft() + data.width > elemPos.left + options.ui.canvas.width()) {
				x2 = elemPos.left + options.ui.canvas.width() - options.ui.canvasCNTR.scrollLeft() - data.width;
			}
			if (y2 < elemPos.top - options.ui.canvasCNTR.scrollTop()) {
				y2 = elemPos.top - options.ui.canvasCNTR.scrollTop();
			} else if (y2 + options.ui.canvasCNTR.scrollTop() + data.height > elemPos.top + options.ui.canvas.height()) {
				y2 = elemPos.top + options.ui.canvas.height() - options.ui.canvasCNTR.scrollTop() - data.height;
			}
			/* aligning */
			mpX = y2 + options.ui.canvasCNTR.scrollTop() - elemPos.top, mpY = x2 + options.ui.canvasCNTR.scrollLeft() - elemPos.left;
			for (var item in options.data.nodeSet) {
				item = options.data.nodeSet[item];
				if (item.id != data.id) {
					if (!xLine) {
						/* top */
						x3 = (mpX + data.height) - item.top;
						if (x3 >= -1 && x3 <= 1) {
							xLine = options.ui.radarXLine.css('top', item.top).show();
							y2 -= x3;
							continue;
						}
						/* middle */
						x3 = (mpX + data.height / 2) - (item.top + item.height / 2);
						if (x3 >= -1 && x3 <= 1) {
							xLine = options.ui.radarXLine.css('top', item.top + item.height / 2).show();
							y2 -= x3;
							continue;
						}
						/* bottom */
						x3 = mpX - (item.top + item.height);
						if (x3 >= -1 && x3 <= 1) {
							xLine = options.ui.radarXLine.css('top', item.top + item.height).show();
							y2 -= x3;
							continue;
						}
						options.ui.radarXLine.hide();
					}
					if (!yLine) {
						/* left */
						y3 = (mpY + data.width) - item.left;
						if (y3 >= -1 && y3 <= 1) {
							yLine = options.ui.radarYLine.css('left', item.left).show();
							x2 -= y3;
							continue;
						}
						/* middle */
						y3 = (mpY + data.width / 2) - (item.left + item.width / 2);
						if (y3 >= -1 && y3 <= 1) {
							yLine = options.ui.radarYLine.css('left', item.left + item.width / 2).show();
							x2 -= y3;
							continue;
						}
						/* right */
						y3 = mpY - (item.left + item.width);
						if (y3 >= -1 && y3 <= 1) {
							yLine = options.ui.radarYLine.css('left', item.left + item.width).show();
							x2 -= y3;
							continue;
						}
						options.ui.radarYLine.hide();
					}
					if (!!xLine && !!yLine) {
						break;
					}
				}
			}
			/* drag-scrollable */
			if (options.canvas.dragScrollable) {
				options.ui.canvasCNTR.scrollLeft(options.ui.canvasCNTR.scrollLeft() - (mousePos.x - _mousePos.x));
				options.ui.canvasCNTR.scrollTop(options.ui.canvasCNTR.scrollTop() - (mousePos.y - _mousePos.y));
			}
			/* shadow-dom */
			x2 += bd.borderWidth / 2, y2 += bd.borderHeight / 2, moved = 1;
			options.ui.snapshot.css({ left: x2, top: y2 }).not(':visible').show();
			/* tips */
			x2 += options.ui.canvasCNTR.scrollLeft() - elemPos.left - bd.borderWidth / 2;
			y2 += options.ui.canvasCNTR.scrollTop() - elemPos.top - bd.borderHeight / 2;
			options.ui.hintbar.html('<table style="border-collapse:collapse;"><tr><td align="right">from:</td><td align="left">' + data.left + 'px, ' + data.top + 'px</td></tr><tr><td align="right">to:</td><td align="left">' + x2 + 'px, ' + y2 + 'px</td></tr></table>').show();
		});
		document.onmouseup = function(_event){
			options.ui.radarXLine.add(options.ui.radarYLine).add(options.ui.snapshot.empty()).add(options.ui.hintbar.empty()).hide();
			document.onmouseup = document.onmousemove = null;
			if (moved) {
				jq.flowchart('moveTo', { id: data.id, kind: kind, left: parseFloat(options.ui.snapshot.css('left')) - elemPos.left + options.ui.canvasCNTR.scrollLeft() - bd.borderWidth / 2, top: parseFloat(options.ui.snapshot.css('top')) - elemPos.top + options.ui.canvasCNTR.scrollTop() - bd.borderHeight / 2 });
			}
			return false;
		};
	};

	function doMarquee(jq, options, event) {
		var mousePos = getMousePosition(event), elemPos = Graphics.Api.coordinate(options.ui.canvas[0]), x1 = mousePos.x - elemPos.left + options.ui.canvasCNTR.scrollLeft(), y1 = mousePos.y - elemPos.top + options.ui.canvasCNTR.scrollTop();
		document.onmousemove = function(_event){
			var _mousePos = getMousePosition(_event || window.event), 
				width = x1 - _mousePos.x + elemPos.left - options.ui.canvasCNTR.scrollLeft(), height = y1 - _mousePos.y + elemPos.top - options.ui.canvasCNTR.scrollTop(), 
				x2 = (width > 0 ? _mousePos.x - elemPos.left + options.ui.canvasCNTR.scrollLeft() : x1), y2 = (height > 0 ? _mousePos.y - elemPos.top + options.ui.canvasCNTR.scrollTop() : y1);
			options.ui.marquee.css({ left: x2, top: y2, width: (width = Math.abs(width)), height: (height = Math.abs(height)) }).not(':visible').show();
			var x3 = x2 + width, y3 = y2 + height, x4, y4, cross;
			for (var item in options.data.nodeSet) {
				item = options.data.nodeSet[item];
				x4 = item.left + item.width;
				y4 = item.top + item.height;
				cross = ((/* top left */x3 >= item.left && x3 <= x4 && y3 >= item.top && y3 <= y4) ||
				(/* bottom left */x3 >= item.left && x3 <= x4 && y2 >= item.top && y2 <= y4) ||
				(/* top right */x2 >= item.left && x2 <= x4 && y3 >= item.top && y3 <= y4) ||
				(/* bottom right */x2 >= item.left && x2 <= x4 && y2 >= item.top && y2 <= y4) ||
				(/* top */x2 <= item.left && x3 >= x4 && y3 >= item.top && y3 <= y4) ||
				(/* right */x2 >= item.left && x2 <= x4 && y2 <= item.top && y3 >= y4) ||
				(/* bottom */x2 <= item.left && x3 >= x4 && y2 >= item.top && y2 <= y4) ||
				(/* left */x3 >= item.left && x3 <= x4 && y2 <= item.top && y3 >= y4) ||
				(/* all */x2 <= item.left && x3 >= x4 && y2 <= item.top && y3 >= y4));
				Graphics.Api.adorn('#' + item.id)[cross ? 'addClass' : 'removeClass']('focused').first().attr('strokeColor', cross ? 'red' : null);
			}
		};
		document.onmouseup = function(_event){
			document.onmouseup = document.onmousemove = null;
			options.ui.marquee.is(':visible') ? options.ui.marquee.hide() : jq.flowchart('blurTo');
			return false;
		};
	};

	function rectContains(options, rectId, event) {
		var rect = options.data.nodeSet[rectId], elemPos = Graphics.Api.coordinate(options.ui.canvas[0]), x = event.pageX - elemPos.left + options.ui.canvasCNTR.scrollLeft(), y = event.pageY - elemPos.top + options.ui.canvasCNTR.scrollTop();
		return x >= rect.left && x <= rect.left + rect.width && y >= rect.top && y <= rect.top + rect.height;
	};

	function initialize(elem) {
		var options = $.data(elem, 'flowchart').options;
		if (!options.initialized) {
			options.initialized = 1;
			elem = $(elem).addClass('flowchart');
			autoSize(elem, options);
			options.scrollbarWidth = getScrollbarWidth();
			options.activeButton = options.activeButton || $.fn.flowchart.defaults.activeButton;
			options.lang = (options.i18n[navigator.language || navigator.browserLanguage] || options.i18n['zh-CN']);
			options.id = elem.addClass('flowchart').css({ color: options.cssStyle.fontColor, width: options.uiWidth, height: options.uiHeight }).attr('id', function(i, v){ return v || 'flowchart' + $('.flowchart').length; }).attr('id');
			options.data.creator = top.sessionUser || 'Anonymous';
			initMenuBar(elem, options);
			initButtonBar(elem, options);
			initCanvas(elem, options);
			initPropertyGrid(elem, options);
			loadDataFromRepository(elem, options);
		}
	};

	function initMenuBar(jq, options) {
		if (options.menubar.visible) {
			options.ui.menubar = $('<div class="flowchart-menubar">');
			options.ui.infobar = $('<big>').appendTo(options.ui.menubar);
			options.ui.hintbar = $('<tt>').appendTo(options.ui.menubar);
			if (options.data.title) {
				options.ui.menubar.append(stringFormat.call('<label title="{0}">{0}</label>', options.data.title));
			}
			if (options.menubar.items.length) {
				var map = { lock: 'unlock', unlock: 'lock', pin: 'unpin', unpin: 'pin' }, items = $.fn.flowchart.defaults.menubar.items, items = items.concat(['-'], $.grep(options.menubar.items, function(e){ return e === '-' || (e && $.inArray(e, items) == -1) })), nameSet = {};
				if (!options.propertyGrid.visible) {
					items = $.grep(items, function(e){ return e != 'pin' && e != 'unpin' });
				}
				for (var i = items.length - 1; i >= 0; i--) {
					var item = items[i];
					if (item === '-') {
						if (i == 0 || i == items.length - 1 || (i > 0 && items[i - 1] === '-')) {
							items.splice(i, 1);
						}
						continue;
					}
					nameSet[item] ? items.splice(i, 1) : (nameSet[item] = items[i] = item);
				}
				options.ui.menubar.append($.map(items.reverse(), function(e){ return e === '-' ? '<span/>' : stringFormat.call('<a href="javascript:void(0)" class="flowchart-menu0" id="{0}-{1}" item="{1}" title="{2}"><i class="icon-{1}"></i></a>', options.id, e, options.lang[e]); }).join('')).on('click', 'a.flowchart-menu0,a.flowchart-menu1', function(){
					var item = $(this).attr('item'), i = $(this).children('i');
					switch (item) {
					case 'open':
						return loadDataFromRepository(jq, options) || options.ui.infobar.text(options.lang['invalid.repository']).stop(true, true).fadeIn().delay(3000).fadeOut();
					case 'json':
						return openJSONViewer(jq, options);
					case 'undo':
						return jq.flowchart('undo', {});
					case 'redo':
						return jq.flowchart('redo', {});
					case 'lock':
					case 'unlock':
						return ($(this).not('.flowchart-menu0').removeClass('flowchart-menu1').addClass('flowchart-menu0').length || $(this).filter('.flowchart-menu0').removeClass('flowchart-menu0').addClass('flowchart-menu1').length) && (i.not('.icon-' + item).removeClass('icon-' + map[item]).addClass('icon-' + item).length || i.filter('.icon-' + item).removeClass('icon-' + item).addClass('icon-' + map[item]).length) && (options.canvas.dragScrollable = i.hasClass('icon-unlock'));
					case 'pin':
					case 'unpin':
						return jq.flowchart('togglePin', true);
					default:
						return options.onMenuItemClick.call(this, item);
					}
				}).on('mouseenter', 'a.flowchart-menu0,a.flowchart-menu1', function(){
					switch ($(this).attr('item')) {
					case 'undo':
						return $(this).attr('title', options.lang['undo'] + '（' + options.buffer.undo.length + ' steps）');
					case 'redo':
						return $(this).attr('title', options.lang['redo'] + '（' + options.buffer.redo.length + ' steps）');
					}
				}).children('[item="lock"]').removeClass('flowchart-menu0').addClass('flowchart-menu1');
			}
			options.menubar.height = options.ui.menubar.appendTo(jq).outerHeight(true);
			options.ui.infobar.add(options.ui.hintbar).css('left', options.ui.menubar.outerWidth(true) / 2 - options.ui.infobar.outerWidth(true) / 2 + jq[0].offsetLeft);
		} else {
			options.menubar.height = 0;
		}
	};

	function initButtonBar(jq, options) {
		if (options.buttonbar.visible) {
			options.ui.buttonbar = $('<div class="flowchart-buttonbar-panel">');
			var items = $.fn.flowchart.defaults.buttonbar.items, names = $.map(items, function(v, k){ return v.name || v }), nameSet = {}, items = items.concat(['-'], $.grep(options.buttonbar.items, function(e){ e = e.name || e; return e === '-' || (e && $.inArray(e, names) == -1); }));
			for (var i = items.length - 1; i >= 0; i--) {
				var item = items[i];
				if (item === '-') {
					if (i == 0 || i == items.length - 1 || (i > 0 && items[i - 1] === '-')) {
						items.splice(i, 1);
					}
					continue;
				}
				if (!$.isPlainObject(item)) {
					item = { name: String(item) };
				}
				if (nameSet[item.name]) {
					items.splice(i, 1);
				} else {
					nameSet[item.name] = item.shape = options.shapeSet[item.shape] ? item.shape : 'roundRect';
					items[i] = item;
				}
			}
			options.buttonbar.items = items;
			options.ui.buttonbarDiv = $('<div>').append($.map(options.buttonbar.items, function(e, i){ return e === '-' ? '<span/>' : stringFormat.call('<a href="javascript:void(0)" class="flowchart-button{0}" id="{1}-{2}" item="{2}" shape="{3}" title="{4}"><i class="icon-{2}"></i></a>', Number(options.activeButton == e.name), options.id, e.name, e.shape, options.lang[e.name] || e.name); }).join('')).appendTo(options.ui.buttonbar);
			options.ui.buttonbarCNTR = $('<div class="flowchart-buttonbar">').append(options.ui.buttonbar).appendTo(jq), gap = options.ui.buttonbarCNTR.outerHeight(true) - options.ui.buttonbarCNTR.height() + options.ui.buttonbar.outerHeight(true) - options.ui.buttonbar.height();
			options.ui.buttonbarUp = $('<b id="up">&and;</b>').prependTo(options.ui.buttonbarCNTR);
			options.ui.buttonbarDown = $('<b id="down">&or;</b>').appendTo(options.ui.buttonbarCNTR);
			options.ui.buttonbarDiv.on('click', 'a.flowchart-button0', function(){
				jq.flowchart('toggleButton', $(this).attr('item'));
			})
			options.ui.buttonbarCNTR.on('mouseenter', 'b#up,b#down', function(){
				var seed = parseFloat(options.ui.buttonbarDiv.css('margin-top')) || 0, goUp = this.id == 'up', maxTop = 0, minTop = options.ui.buttonbar.height() - options.ui.buttonbarDiv.height() - options.ui.buttonbarDown.height();
				$(this).data('timer', setInterval(function(){
					if (goUp) {
						--seed >= minTop && options.ui.buttonbarDiv.css('margin-top', seed);
					} else {
						++seed <= maxTop && options.ui.buttonbarDiv.css('margin-top', seed);
					}
				}, 10));
			}).on('mouseleave', 'b#up,b#down', function(){
				clearInterval($(this).data('timer'));
			});
			if (options.menubar.visible) {
				gap += getElementGap(options.ui.menubar).bottom;
			} else {
				var elemGap = getElementGap(options.ui.buttonbarCNTR);
				gap += elemGap.left << 1;
				options.ui.buttonbarCNTR.css('margin-top', elemGap.left);
			}
			options.buttonbar.height = options.uiHeight - options.menubar.height - gap;
			options.buttonbar.width = options.ui.buttonbarCNTR.outerWidth(true);
			options.ui.buttonbar.height(options.buttonbar.height);
			toggleScrollButton(jq, options);
		} else {
			options.buttonbar.width = 0;
		}
	};

	function initCanvas(jq, options) {
		options.ui.canvas = $('<div class="flowchart-canvas-panel" unselectable="on" onselectstart="return false" onselect="document.selection.empty()">');
		options.ui.canvasCNTR = $('<div class="flowchart-canvas">').append(options.ui.canvas).appendTo(jq);
		var elemGap = getElementGap(options.ui.canvasCNTR);
		options.canvas.offsetWidth = elemGap.left + elemGap.right + parseFloat(options.ui.canvasCNTR.css('border-left-width')) + parseFloat(options.ui.canvasCNTR.css('border-right-width'));
		options.canvas.width = options.uiWidth - options.buttonbar.width - (options.propertyGrid.visible ? options.propertyGrid.width : 0) - options.canvas.offsetWidth;
		options.canvas.height = parseFloat(options.ui.buttonbarCNTR.css('height'));
		options.canvas.panelWidth = options.canvas.width << 2;
		options.canvas.panelHeight = options.canvas.height << 2;
		options.ui.canvas.css({ width: options.canvas.panelWidth, height: options.canvas.panelHeight });
		options.ui.canvasCNTR.css({ width: options.canvas.width, height: options.canvas.height, 'margin-top': options.ui.buttonbarCNTR.css('margin-top') });
		initPainter(jq, options);
		initComponents(jq, options);
		if (options.canvas.editable) {
			options.ui.canvasCNTR.on('click', 'div.flowchart-canvas-panel', function(event){
				if (options.activeButton == 'marquee') {
					return;
				} else if (options.activeButton == 'cursor') {
					var that = $(event.target);
					if (that.is('svg,group,div.flowchart-canvas-panel,div.flowchart-canvas-vml')) {
						if (options.ui.widget.data('key')) {
							jq.flowchart('focusTo', { id: options.ui.widget.data('key'), selection: false });
						} else {
							jq.flowchart('blurTo');
						}
					}
				} else if (options.activeButton != 'line') {
					var elemPos = Graphics.Api.coordinate(this), x = event.pageX - elemPos.left + this.parentNode.scrollLeft, y = event.pageY - elemPos.top + this.parentNode.scrollTop;
					jq.flowchart('appendNode', { id: (options.id + '-node' + (options.serialNumber++)), left: x, top: y, kind: options.activeButton });
				}
			}).on('mousemove', 'div.flowchart-canvas-panel', function(event){
				var elemPos = Graphics.Api.coordinate(this), x = event.pageX - elemPos.left + this.parentNode.scrollLeft, y = event.pageY - elemPos.top + this.parentNode.scrollTop;
				options.ui.axisX.css('left', x);
				options.ui.axisY.css('top', y);
				if (options.activeButton != 'marquee' && (options.activeButton == 'line' || options.ui.knob2.data('point'))) {
					var data = options.ui.canvas.data();
					if (data.fromPoint || data.toPoint) {
						var line2d;
						if (data.fromPoint) {
							line2d = [data.fromPoint.x, data.fromPoint.y, x, y];
						} else if (data.toPoint) {
							line2d = [x, y, data.toPoint.x, data.toPoint.y];
						}
						Graphics.Api.adorn('#' + XLINE).children('line').forEach(function(item){
							item.from(line2d[0], line2d[1]).to(line2d[2], line2d[3]).css('marker-end', function(i, v){ return v == 'url("#arrow2")' ? 'url(#arrow3)' : 'url(#arrow2)'; });
						});
					}
				}
			}).on('mouseup', 'div.flowchart-canvas-panel', function(event){
				if (event.button == 2 && options.ui.contextmenuCNTR) {
					popupContextMenu(jq, options, event);
				}
				if (options.activeButton != 'marquee' && (options.activeButton == 'line' || options.ui.knob2.data('point'))) {
					var xline = document.getElementById(XLINE);
					if (xline) {
						var data = options.ui.canvas.css('cursor', 'auto').data();
						options.ui.knob1.add(options.ui.knob2).removeData('point').hide();
						xline.parentNode.removeChild(xline);
						jq.flowchart('focusTo', { id: options.activeNode, selection: false });
						/* FIX-VML MSIE */
						(data.fromPoint || data.toPoint) && (data = document.elementFromPoint(event.clientX, event.clientY)) && $(data).trigger(event.type);
						options.ui.canvas.removeData('fromPoint').removeData('toPoint');
					} else if (options.buffer.stack.pop() !== options.activeNode) {
						options.ui.widget.removeData('key');
					}
				}
			}).on('scroll', function(event){
				options.ui.rulerY.add(options.ui.axisY).css({'left': event.target.scrollLeft });
				options.ui.rulerX.add(options.ui.axisX).css({'top': event.target.scrollTop });
			}).on('mousedown', function(event){
				if (event.button == 2) {
					return false;
				} else if ($(event.target).is('textarea')) {
					return;
				}
				closeEditor(jq, options);
				if (options.activeButton == 'marquee') {
					doMarquee(jq, options, event);
				}
			});
		}
	};

	function initPainter(jq, options) {
		if (Graphics.VML.supported) {
			var vml = options.ui.canvas.prepend(stringFormat.call('<div class="flowchart-canvas-vml" style="width:{0}px;height:{1}px;">', options.canvas.panelWidth, options.canvas.panelHeight)).children("div.flowchart-canvas-vml");
			options.ui.graphics = Graphics(vml).attr('coordsize', [options.canvas.panelWidth, options.canvas.panelHeight]).css({ display: 'block', position: 'relative' });
			options.ui.painter = options.ui.graphics.domElement();
		} else {
			options.ui.graphics = Graphics(options.ui.canvas);
			options.ui.graphics.arrow('arrow1').css({ fill: 'none', stroke: options.cssStyle.lineColor, 'pointer-events': 'none' });
			options.ui.graphics.arrow('arrow2').css({ fill: 'none', stroke: options.cssStyle.highlightColor, 'pointer-events': 'none' });
			options.ui.graphics.arrow('arrow3').css({ fill: 'none', stroke: options.cssStyle.highlightColor, 'pointer-events': 'none' });
			options.ui.graphics.gradient('linear').attr({ id: 'color-yellow', x1: '0%', y1: '0%', x2: '50%', y2: '100%' }).stop('0%', 'stop-color:#FFFFCC;stop-opacity:1').stop('100%', 'stop-color:#FFFF88;stop-opacity:1');
			options.ui.graphics.gradient('linear').attr({ id: 'color-red', x1: '0%', y1: '0%', x2: '50%', y2: '100%' }).stop('0%', 'stop-color:#FFCCCC;stop-opacity:1').stop('100%', 'stop-color:#FF8888;stop-opacity:1');
			options.ui.graphics.gradient('linear').attr({ id: 'color-blue', x1: '0%', y1: '0%', x2: '50%', y2: '100%' }).stop('0%', 'stop-color:#99CCFF;stop-opacity:1').stop('100%', 'stop-color:#999CFF;stop-opacity:1');
			options.ui.graphics.gradient('linear').attr({ id: 'color-green', x1: '0%', y1: '0%', x2: '50%', y2: '100%' }).stop('0%', 'stop-color:#CCFFCC;stop-opacity:1').stop('100%', 'stop-color:#CCFF88;stop-opacity:1');
			options.ui.graphics.gradient('linear').attr({ id: 'color-black', x1: '0%', y1: '0%', x2: '40%', y2: '80%' }).stop('0%', 'stop-color:#CCC;stop-opacity:1').stop('100%', 'stop-color:#333;stop-opacity:1');
			options.ui.graphics.gradient('linear').attr({ id: 'color-white', x1: '0%', y1: '0%', x2: '50%', y2: '100%' }).stop('0%', 'stop-color:#FFF;stop-opacity:1').stop('100%', 'stop-color:#F5F5F5;stop-opacity:1');
			options.ui.graphics.gradient('linear').attr({ id: 'color-orange', x1: '0%', y1: '0%', x2: '50%', y2: '100%' }).stop('0%', 'stop-color:#FFF;stop-opacity:1').stop('100%', 'stop-color:#FFA500;stop-opacity:1');
			options.ui.graphics.gradient('linear').attr({ id: 'color-gray', x1: '0%', y1: '0%', x2: '50%', y2: '100%' }).stop('0%', 'stop-color:#D3D3D3;stop-opacity:1').stop('100%', 'stop-color:#A9A9A9;stop-opacity:1');
			options.ui.graphics.templates().filter().attr({ id: 'bgcolor-yellow' }).move(0, 0).size(1, 1);
			options.ui.graphics.templates().image('images/note.png').attr('id', 'icon-note').size(24, 24);
			options.ui.graphics.templates().image('images/action.png').attr('id', 'icon-action').size(24, 24);
			options.ui.graphics.templates().image('images/process.png').attr('id', 'icon-process').size(24, 24);
			options.ui.graphics.templates().image('images/decision.png').attr('id', 'icon-decision').size(24, 24);
			options.ui.graphics.templates().image('images/initial.png').attr('id', 'icon-initial').size(24, 24);
			options.ui.graphics.templates().image('images/final.png').attr('id', 'icon-final').size(24, 24);
			options.ui.graphics.templates().image('images/fork.png').attr('id', 'icon-fork').size(24, 24);
			options.ui.graphics.templates().image('images/join.png').attr('id', 'icon-join').size(24, 24);
			options.ui.graphics.templates().image('images/se.png').attr('id', 'icon-se').size(12, 12);
			options.ui.graphics.templates().image('images/sw.png').attr('id', 'icon-sw').size(12, 12);
			options.ui.graphics.templates().image('images/ne.png').attr('id', 'icon-ne').size(12, 12);
			options.ui.graphics.templates().image('images/nw.png').attr('id', 'icon-nw').size(12, 12);
			options.ui.graphics.templates().rect(6, 6).attr('id', 'knob').rx(0).ry(0).css({ fill: 'blue', stroke: 'blue' });
			var oneHalf = options.nodeHeight * 0.5, threeQuarters = options.nodeHeight * 0.75, pos = (options.nodeHeight - threeQuarters) * 0.5;
			options.ui.graphics.templates().nested().attr('id', 'initial-node').size(options.nodeHeight, options.nodeHeight).rect('100%','100%').rx(oneHalf).ry(oneHalf).attr('fill', 'url(#color-black)');
			options.ui.graphics.templates().nested().attr('id', 'final-node').size(options.nodeHeight, options.nodeHeight).css('fill', '#FFF').rect('100%', '100%').rx(oneHalf).ry(oneHalf).parent().rect(threeQuarters, threeQuarters).rx(threeQuarters >> 1).ry(threeQuarters >> 1).move(pos, pos).attr('fill', 'url(#color-black)').css('stroke', 'black');
			options.ui.graphics.templates().nested().attr('id', 'decision-node').rhombus(options.nodeHeight, options.nodeHeight).move(0, 0).attr('fill', 'url(#color-yellow)');
			options.ui.painter = options.ui.graphics.domElement();
		}

		options.ui.graphics.attr('id', options.id + '-painter').size(options.canvas.panelWidth, options.canvas.panelHeight);

		if (options.canvas.editable) {
			$(options.ui.painter).on('click', 'g,div.flowchart-node', function(event){
				if (options.activeNode !== this.id) {
					jq.flowchart('focusTo', { id: this.id, selection: true });
				}
			}).on('click', 'div.remove', function(event){
				jq.flowchart('removeNode', { id: options.activeNode, kind: 'node' });
			}).on('dblclick', 'g > text,g > tspan,div.flowchart-node > label', function(event){
				var text = Graphics.Api.adorn(this), offset = text.offset(), elemPos = Graphics.Api.coordinate(options.ui.canvas[0]);
				openEditor(jq, options, offset.left - elemPos.left + options.ui.canvasCNTR.scrollLeft(), offset.top - elemPos.top + options.ui.canvasCNTR.scrollTop(), text, 'node');
				return false;
			}).on('dblclick', 'svg > text,svg > tspan,div.line1 > label', function(event){
				var text = Graphics.Api.adorn(this), bbox = text.bbox(), parent = text.parent('svg,div'), from = parent.attr('from').split(','), to = parent.attr('to').split(','), x, y;
				switch (options.data.lineSet[parent.attr('id')].style) {
				case 'b2t':
					to[1] = from[1] = options.data.lineSet[parent.attr('id')].mid;
					break;
				case 'l2r':
					to[0] = from[0] = options.data.lineSet[parent.attr('id')].mid;
					break;
				}
				options.ui.widget.hide();
				x = (parseInt(from[0], 10) + parseInt(to[0], 10)) / 2 - bbox.width / 2;
				y = (parseInt(from[1], 10) + parseInt(to[1], 10)) / 2 - bbox.height / 2;
				openEditor(jq, options, x, y, text, 'line', parent.attr('id'));
				return !!clearTimeout(text.data('timer'));
			}).on('mouseenter', 'g[id!=xline],div.flowchart-node', function(event){
				if (options.activeButton == 'line' || document.getElementById(XLINE)) {
					var fp = options.ui.canvas.data('fromPoint');
					if (fp && fp.id == this.id && event.relatedTarget && event.relatedTarget.parentNode.id != XLINE) {
						options.ui.infobar.text(options.lang['invalid.link']).stop(true, true).fadeIn().delay(3000).fadeOut();
					}
					Graphics.Api.adorn(this).addClass('entered highlight crosshair').first().attr('strokeColor', 'red').css('cursor', 'crosshair');
				}
			}).on('mouseleave', 'g[id!=xline],div.flowchart-node', function(event){
				if (event.relatedTarget && event.relatedTarget.parentNode.id == XLINE) {
					return false;
				}
				var that = Graphics.Api.adorn(this);
				if (that.hasClass('entered')) {
					options.ui.infobar.stop(false, true);
					that.removeClass('entered highlight crosshair').first().removeAttr('strokeColor').css('cursor', null);
				}
			}).on('mousedown', 'line,polyline', function(event){
				if (Graphics.Api.adorn(this.parentNode).hasClass('line1')) {
					jq.flowchart('focusTo', { id: this.parentNode.id, selection: true });
					options.buffer.stack.push(options.activeNode);
					return false;
				}
			}).on('mousedown', 'g,div.flowchart-node', function(event){
				var that = Graphics.Api.adorn(event.target);
				if (options.activeButton == 'line') {
					var elemPos = Graphics.Api.coordinate(options.ui.canvas[0]), x1 = event.pageX - elemPos.left + options.ui.canvasCNTR.scrollLeft(), y1 = event.pageY - elemPos.top + options.ui.canvasCNTR.scrollTop();
					options.ui.canvas.data('fromPoint', { id: this.id, x: x1, y: y1 }).css('cursor', 'crosshair');
					jq.flowchart('drawLine', { id: XLINE, line: { marked: true, dashed: true }, line2d: { p1: { x: x1, y: y1 }, p2: { x: x1, y: y1 } } });
				} else {
					if (that.css('cursor') == 'text' || that.css('cursor').search(/[a-z]-resize/i) == -1) {
						if (options.activeNode !== this.id) {
							jq.flowchart('focusTo', { id: this.id, selection: true });
						}
						if (event.button != 2) {
							doMoving(jq, options, event, options.data.nodeSet[this.id], 'node');
						}
					} else {
						jq.flowchart('toggleButton', 'cursor');
						doResizing(jq, options, event, options.data.nodeSet[options.activeNode], 'node', options.nodeWidth, options.nodeHeight);
					}
				}
			}).on('mouseup', 'g,div.flowchart-node', function(event){
				var point2 = options.ui.knob2.data('point');
				if (options.activeButton == 'line' || point2) {
					var data = options.ui.canvas.data();
					if (data.fromPoint && !point2) {
						jq.flowchart('appendLine', { id: (options.id + '-line' + (options.serialNumber++)), from: data.fromPoint.id, to: this.id });
					} else {
						if (data.fromPoint) {
							jq.flowchart('relinkLine', { id: options.activeNode, from: data.fromPoint.id, to: this.id });
						} else if (data.toPoint) {
							jq.flowchart('relinkLine', { id: options.activeNode, from: this.id, to: data.toPoint.id });
						}
						if (!options.data.nodeSet[this.id].marked) {
							$(this).removeClass('highlight').css('border-color', this.id == options.activeNode ? options.cssStyle.lineColor : options.cssStyle.nodeColor);
						}
					}
					options.ui.canvas.removeData('fromPoint').removeData('toPoint');
				}
			});
		}
	};

	function initComponents(jq, options) {
		initContextMenu(jq, options);
		initSplitter(jq, options);
		initKnobs(jq, options);
		initRulers(jq, options);
		initWidget(jq, options);
		initEvents(jq, options);
		options.ui.snapshot = $('<div class="flowchart-snapshot" unselectable="on" onselectstart="return false" onselect="document.selection.empty()">').appendTo(jq);
		options.ui.editor = $('<textarea class="flowchart-editor" rows="1">').appendTo(options.ui.canvasCNTR);
		options.ui.marquee = $('<div class="flowchart-marquee">').appendTo(options.ui.canvasCNTR);
		options.ui.radarXLine = $('<div class="flowchart-radar-xline">').appendTo(options.ui.canvasCNTR);
		options.ui.radarYLine = $('<div class="flowchart-radar-yline">').appendTo(options.ui.canvasCNTR);
		options.ui.controller = $('<div class="flowchart-controller">').appendTo(options.ui.canvasCNTR);
	};

	function initContextMenu(jq, options) {
		$.fn.flowchart.defaults.contextmenu.items.concat(options.contextmenu.items);
		if (options.canvas.editable && options.contextmenu.visible && options.contextmenu.items.length) {
			options.ui.contextmenuCNTR = $('<div class="flowchart-contextmenu">').appendTo(jq);
			options.ui.contextmenu = $('<dl unselectable="on" onselectstart="return false" onselect="document.selection.empty()">').appendTo(options.ui.contextmenuCNTR);
			(function(items, prefix){
				for (var i = 0, x; i < items.length; i++) {
					x = items[i] === '-' ? $('<dd>').appendTo(this) : $('<dt id="' + prefix + '-' + i + '" class="dt' + Number(items[i].disabled) + '">').html(options.lang[items[i].text] || items[i].text).on('click', items[i], function(event){ console.log(event); if ($(this).hasClass('dt1')) return false; $.isFunction(event.data.onclick) && event.data.onclick.call(this) }).appendTo(this);
					$.isArray(items[i].children) && items[i].children.length && arguments.callee.call($('<dl>').appendTo(x), items[i].children, prefix + '-' + i);
				}
			}).call(options.ui.contextmenu, options.contextmenu.items, 'contextmenu');
			options.ui.contextmenu.on('mouseenter', 'dt', function(event){
				/* Auto-Adaptive width */
				if (!this.parentNode.adaptive) {
					this.parentNode.adaptive = 1;
					var width = $(this).width();
					$(this).siblings('dt').each(function(){ width = Math.max($(this).width(), width) }).addBack().css('width', width);
				}
				/* Show submenu */
				var dl = $(this).children('dl').css({ display: 'block', left: this.offsetWidth - 6, top: this.offsetTop });
				if (dl.length) {
					var offset = dl.offset();
					if (options.canvas.width - dl.outerWidth() < offset.left) {
						dl.css('left', 0 - dl.innerWidth());
					}
					if (options.canvas.height - dl.outerHeight() < offset.top) {
						dl.css('top', 0 - dl.innerHeight() + this.offsetTop + this.clientHeight);
					}
				}
			}).on('mouseleave', 'dt', function(event){
				$(this).children('dl').hide();
			}).find('dt:has(dl)').prepend('<span>&#133;</span>').end();
			document.oncontextmenu = function(event){
				event = event || window.event;
				var that = event.target || event.srcElement;
				if (jq[0] == that || (!/input|textarea/i.test(that.tagName) && jq.has(that).length)) {
					event.preventDefault ? event.preventDefault() : event.returnValue = false;
				}
			};
		}
	};

	function popupContextMenu(jq, options, event) {
		var elemPos = Graphics.Api.coordinate(options.ui.canvas[0]);
		options.ui.contextmenuCNTR.css({ display: 'block', left: Math.min(event.clientX, options.canvas.width + elemPos.left - options.ui.contextmenuCNTR.outerWidth() - options.scrollbarWidth), top: Math.min(event.clientY, options.canvas.height + elemPos.top - options.ui.contextmenuCNTR.outerHeight() - options.scrollbarWidth) });
	};

	function initSplitter(jq, options) {
		options.ui.splitter = $('<div class="flowchart-splitter">').appendTo(options.ui.canvas).on('mousedown', function(event){
			if (event.button == 2) {
				return false;
			}
			options.ui.splitter.css('background-color', options.cssStyle.fontColor);
			var elemPos = Graphics.Api.coordinate(options.ui.canvas[0]), thisPos = options.ui.splitter.position(), moved = 0;
			var x1 = event.pageX - elemPos.left + options.ui.canvasCNTR.scrollLeft() - thisPos.left, y1 = event.pageY - elemPos.top + options.ui.canvasCNTR.scrollTop() - thisPos.top;
			document.onmousemove = function(event){
				var _mousePos = getMousePosition(event || window.event), x2 = _mousePos.x - elemPos.left + options.ui.canvasCNTR.scrollLeft(), y2 = _mousePos.y - elemPos.top + options.ui.canvasCNTR.scrollTop();
				switch (options.ui.splitter.data('style')) {
				case 'b2t':
					options.ui.splitter.css('top', y2 < y1 ? 0 : Math.min(y2 - y1, options.ui.canvas.height()));
					break;
				case 'l2r':
					options.ui.splitter.css('left', x2 < x1 ? 0 : Math.min(x2 - x1, options.ui.canvas.width()));
					break;
				}
				moved = 1;
			};
			document.onmouseup = function(event){
				document.onmouseup = document.onmousemove = null;
				if (moved) {
					var _thisPos = options.ui.splitter.position();
					switch (options.ui.splitter.data('style')) {
					case 'b2t':
						jq.flowchart('setLineMidpoint', { id: options.ui.splitter.data('key'), mid: _thisPos.top, disableUndo: false });
						break;
					case 'l2r':
						jq.flowchart('setLineMidpoint', { id: options.ui.splitter.data('key'), mid: _thisPos.left, disableUndo: false });
						break;
					}
				}
				if (options.ui.splitter.css('background-color', 'transparent').data('key') == options.activeNode) {
					jq.flowchart('focusTo', { id: options.ui.splitter.data('key'), selection: false });
				}
			};
		});
	};

	function initKnobs(jq, options) {
		var onKnobPresse = function(event){
			jq.flowchart('toggleButton', 'cursor');
			var key = $(this).hide().attr('key'), line2d = { from: options.ui.knob1.data('point'), to: options.ui.knob2.data('point') }, data = options.data.lineSet[options.ui.widget.data('key')];
			options.ui.canvas.data(key + 'Point', { id: data[key], x: line2d[key][0], y: line2d[key][1] }).css('cursor', 'crosshair');
			jq.flowchart('drawLine', { id: XLINE, line: data, line2d: { p1: { x: line2d.from[0], y: line2d.from[1] }, p2: { x: line2d.to[0], y: line2d.to[1] } }, marked: 1, dashed: 1 });
		};
		options.ui.knob1 = $('<div class="flowchart-knob" key="to">').appendTo(options.ui.canvas).on('mousedown', onKnobPresse);
		options.ui.knob2 = $('<div class="flowchart-knob" key="from">').appendTo(options.ui.canvas).on('mousedown', onKnobPresse);
	};

	function initRulers(jq, options) {
		/* TOP */
		var num = Number(!Graphics.VML.supported), sections = '<div style="width:9px;border-left:1px transparent solid;"></div>', width = options.canvas.panelWidth - options.scrollbarWidth, size = width / options.ruler.scale + 1, halfScale = parseInt(options.ruler.scale / 2) + options.ruler.scale % 2;
		for (var i = 1, k = 1; i <= size; i++, k++) {
			if (k % options.ruler.scale == 0) {
				sections += ('<span>' + (k * 10) + '</span>');
			} else {
				sections += ('<div' + (k % halfScale == 0 ? ' class="half-scaleX"' : '') + '></div>');
			}
		}
		if (width % options.ruler.scale > 1) {
			sections += '<div style="width:auto;"></div>';
		}
		options.ui.rulerX = $('<div class="flowchart-rulerX">').width(options.canvas.panelWidth).append(sections).appendTo(options.ui.canvasCNTR);
		options.ui.rulerX.children('span:last').css('overflow', 'hidden');
		/* LEFT */
		sections = '<div style="height:9px;border-top:1px transparent solid;"></div>', width = options.canvas.panelHeight - options.scrollbarWidth, size = width / options.ruler.scale + 1;
		for (var i = 1, k = 1; i <= size; i++, k++) {
			if (k % options.ruler.scale == 0) {
				sections += ('<span><label class="rotate' + num + '">' + (k * 10) + '</label></span>');
			} else {
				sections += ('<div class="msie-min-height-fix' + (k % halfScale == 0 ? ' half-scaleY' : '') + '"></div>');
			}
		}
		if (width % options.ruler.scale > 1) {
			sections += '<div style="height:auto;" class="msie-min-height-fix"></div>';
		}
		options.ui.rulerY = $('<div class="flowchart-rulerY">').height(options.canvas.panelHeight).append(sections).appendTo(options.ui.canvasCNTR);
		options.ui.rulerY.children('span:last').css('overflow', 'hidden');
		/* AXIS */
		options.ui.axisX = $('<i class="flowchart-axisX msie-min-height-fix"></i>').appendTo(options.ui.canvasCNTR);
		options.ui.axisY = $('<i class="flowchart-axisY msie-min-height-fix"></i>').appendTo(options.ui.canvasCNTR);
		/* FIRE */
		options.ui.rulerY.add(options.ui.rulerX).add(options.ui.axisX).add(options.ui.axisY)[options.ruler.visible ? 'show' : 'hide']();
	};

	function initWidget(jq, options) {
		options.ui.widget = $(stringFormat.call('<div class="flowchart-widget"><i class="icon-sl" title="{0}" line="sl"></i><i class="icon-b2t" title="{1}" line="b2t"></i><i class="icon-l2r" title="{2}" line="l2r"></i><span/><small class="icon-solid" title="{3}">Line</small><small class="icon-dashed" title="{4}">Style</small><span/><i class="icon-remove" title="{5}"></i></div>', options.lang.sl, options.lang.b2t, options.lang.l2r, options.lang.solid, options.lang.dashed, options.lang.remove)).appendTo(options.ui.canvasCNTR).on('click', function(event){
			var that = $(event.target), id = options.ui.widget.data('key');
			if (that.is('i.icon-remove')) {
				jq.flowchart('removeLine', { id: id, kind: 'line' });
				options.ui.widget.hide();
			} else if (that.not('.selected').is('i,small')) {
				jq.flowchart('setLineStyle', { id: id, style: that.attr('line'), dashed: that.hasClass('icon-dashed') || (that.is('i') && options.data.lineSet[id].dashed) });
			}
		});
	};

	function initEvents(jq, options) {
		$(window).off('resize').on('resize', function(event){
			autoSize(jq, options);
			var adjWidth = options.uiWidth - parseFloat(jq.css('width')), adjHeight = options.uiHeight - parseFloat(jq.css('height')), dialog = jq.children('div.flowchart-dialog');
			jq.css({ width: options.uiWidth, height: options.uiHeight });
			options.ui.buttonbar.height(parseFloat(options.ui.buttonbar.css('height')) + adjHeight);
			options.ui.canvasCNTR.css({ width: parseFloat(options.ui.canvasCNTR.css('width')) + adjWidth, height: parseFloat(options.ui.canvasCNTR.css('height')) + adjHeight });
			if (options.propertyGrid.visible) {
				options.ui.propertyGridCNTR.height(parseFloat(options.ui.propertyGridCNTR.css('height')) + adjHeight);
				options.ui.propertyGridContent.height(parseFloat(options.ui.buttonbarCNTR.css('height')) - options.ui.propertyGridHeader.outerHeight(true) - options.ui.propertyGridFooter.outerHeight(true) - (options.ui.propertyGridContent.outerHeight(true) - options.ui.propertyGridContent.height()));
			}
			options.ui.infobar.css('left', options.ui.menubar.outerWidth(true) / 2 - options.ui.infobar.outerWidth(true) / 2 + jq[0].offsetLeft);
			dialog.length && (dialog.find('i.icon-restore').removeClass('icon-restore').addClass('icon-maximize').click().length || dialog.find('i.icon-maximize').removeClass('icon-maximize').addClass('icon-restore').click().length);
			jq.children('div.flowchart-blockUI').length && mask(jq, options);
			toggleScrollButton(jq, options);
		});
		$(document).off('dragstart keydown click').on('dragstart', function(event){
			if ($(event.target).is('img,image')) {
				return false;
			}
		}).on('click', function(event){
			if (event.button != 2) {
				options.ui.contextmenuCNTR.hide();
			}
			if (options.ui.ctrlA && options.ui.ctrlA.length && !/dt/i.test(event.target.tagName)) {
				options.ui.ctrlA.each(function(){ Graphics.Api.adorn(this).removeClass('focused').first().removeAttr('strokeColor') });
				delete options.ui.ctrlA;
			}
		}).on('keydown', function(event){
			if ($(event.target).is('input,select,textarea')) {
				return;
			}
			var data = options.data.nodeSet[options.activeNode];
			/* ESC */
			if (event.which == 27) {
				event.preventDefault();
				jq.children('div.flowchart-dialog').remove();
				unmask(jq);
			}
			/* CTRL+Z */
			else if (event.ctrlKey && event.which == 90) {
				event.preventDefault();
				undo(jq, options);
			}
			/* CTRL+Y */
			else if (event.ctrlKey && event.which == 89) {
				event.preventDefault();
				redo(jq, options);
			}
			/* CTRL+U */
			else if (event.ctrlKey && event.which == 85) {
				event.preventDefault();
				if (data || (data = options.data.lineSet[options.activeNode])) {
					editPropertyGrid(jq, options);
				}
			}
			/* CTRL+X */
			else if (event.ctrlKey && event.which == 88) {
				event.preventDefault();
				if (data) {
					options.buffer.copiedData = null;
					jq.flowchart('removeNode', options.buffer.cutData = data);
				}
			}
			/* CTRL+C */
			else if (event.ctrlKey && event.which == 67 && (!options.propertyGrid.visible || !options.ui.propertyGridCNTR.has(event.target).length)) {
				event.preventDefault();
				if (options.buffer.cutData) {
					jq.flowchart('appendNode', data = options.buffer.cutData);
				}
				if (data) {
					options.buffer.copiedData = $.extend(true, {}, data);
					options.buffer.copiedData.id = null;
				}
			}
			/* CTRL+V */
			else if (event.ctrlKey && event.which == 86) {
				event.preventDefault();
				data = options.buffer.copiedData || options.buffer.cutData;
				if (data) {
					jq.flowchart('appendNode', data);
					options.buffer.cutData = null;
				}
			}
			/* CTRL+A */
			else if (event.ctrlKey && event.which == 65) {
				event.preventDefault();
				options.ui.ctrlA = options.ui.canvas.find('g,div.flowchart-node').each(function(){ Graphics.Api.adorn(this).addClass('focused').first().attr('strokeColor', 'red') });
			}
			/* CTRL+D */
			else if (event.which == 68) {
				if (options.ui.ctrlA && options.ui.ctrlA.length && window.confirm('Delete all selected?')) {
					jq.flowchart('clear');
				} else if (data) {
					if (data.kind == 'line') {
						jq.flowchart('removeLine', { id: data.id, kind: 'line' });
					} else {
						jq.flowchart('removeNode', { id: data.id, kind: 'node' });
					}
				} else {
					options.ui.canvas.find('g.focused,div.focused').each(function(){
						if (options.data.nodeSet[this.id]) {
							jq.flowchart('removeNode', { id: this.id, kind: 'node' });
						}
					});
				}
			}
			/* CTRL+SHIFT+E */
			else if (event.ctrlKey && event.shiftKey && event.which == 69) {
				event.preventDefault();
				var svgString = new XMLSerializer().serializeToString(options.ui.painter);
				var svgBlob = new Blob(['<?xml version="1.0" encoding="utf-8"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">' + svgString], { type: 'image/svg+xml;charset=utf-8' });
				var DOMURL = self.URL || self.webkitURL || self;
				var url = DOMURL.createObjectURL(svgBlob);
				var img = new Image();
				img.src = url;
				img.crossOrigin = 'Anonymous';
				img.onload = function(){
					console.log("img.onload event fired");
					var canvas = document.createElement('canvas'), bbox = getImageBoundingBox(options);
					canvas.width = bbox.width - bbox.x || 300;
					canvas.height = bbox.height - bbox.y || 150;
					canvas.getContext('2d').drawImage(img, bbox.x, bbox.y, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
					var png = canvas.toDataURL('image/png');
					var dlLink = document.createElement('a');
					dlLink.download = options.data.title + '.png';
					dlLink.href = png;
					document.body.appendChild(dlLink);
					dlLink.click();
					document.body.removeChild(dlLink);
					DOMURL.revokeObjectURL(png);
					DOMURL.revokeObjectURL(url);
				};
				img.onerror = function(){
					options.ui.infobar.text(options.lang['image.export']).stop(true, true).fadeIn().delay(3000).fadeOut();
				};
			}
			/* CTRL+SHIFT+R or CTRL+SHIFT+1 — CTRL+SHIFT+9 */
			else if (event.ctrlKey && event.shiftKey && (event.which >= 82 || event.which >= 49 && event.which <= 57)) {
				event.preventDefault();
				if (data) {
					jq.flowchart('recolor', { id: data.id, kind: 'node', color: options.eventColorMap[event.which] });
				}
			}
			/* LEFT or CTRL+SHIFT+LEFT */
			else if (event.which == 37) {
				event.preventDefault();
				if (data) {
					jq.flowchart('moveTo', { id: data.id, kind: 'node', left: data.left - 1, top: data.top });
				}
			}
			/* UP or CTRL+UP or CTRL+SHIFT+UP */
			else if (event.which == 38) {
				event.preventDefault();
				if (data) {
					if (event.ctrlKey) {
						Graphics.Api[event.shiftKey ? 'bringToFront' : 'bringForward']($('#' + data.id).parent()[0]);
					} else {
						jq.flowchart('moveTo', { id: data.id, kind: 'node', left: data.left, top: data.top - 1 });
					}
				}
			}
			/* RIGHT or CTRL+SHIFT+RIGHT */
			else if (event.which == 39) {
				event.preventDefault();
				if (data) {
					jq.flowchart('moveTo', { id: data.id, kind: 'node', left: data.left + 1, top: data.top });
				}
			}
			/* DOWN or CTRL+DOWN or CTRL+SHIFT+DOWN */
			else if (event.which == 40) {
				event.preventDefault();
				if (data) {
					if (event.ctrlKey) {
						Graphics.Api[event.shiftKey ? 'sendToBack' : 'sendBackward']($('#' + data.id).parent()[0]);
					} else {
						jq.flowchart('moveTo', { id: data.id, kind: 'node', left: data.left, top: data.top + 1 });
					}
				}
			}
		});
	};

	function initPropertyGrid(jq, options) {
		if (!options.propertyGrid.visible) {
			return false;
		}
		options.ui.propertyGridCNTR = $('<div class="flowchart-property-grid">').css({ width: options.propertyGrid.width - options.canvas.offsetWidth, height: options.canvas.height }).insertBefore(options.ui.canvasCNTR);
		options.ui.propertyGridHeader = $('<div class="header">Property Editor</div>').appendTo(options.ui.propertyGridCNTR);
		options.ui.propertyGridFooter = $('<div class="footer">' + options.lang.propertygrid.tips + '</div>').appendTo(options.ui.propertyGridCNTR);
		options.ui.propertyGridContent = $('<div class="content"><table cellspacing="0"><col/><col/><tbody></tbody></table></div>').insertBefore(options.ui.propertyGridFooter);
		options.ui.propertyGrid = options.ui.propertyGridContent.children('table');
		options.ui.propertyGridContent.height(options.canvas.height - options.ui.propertyGridHeader.outerHeight(true) - options.ui.propertyGridFooter.outerHeight(true) - (options.ui.propertyGridContent.outerHeight(true) - options.ui.propertyGridContent.height()));
		jq.flowchart('togglePin', false);
		var rows = ['<tr class="general"><th colspan="2" id="general-caption" class="no-top-border">General Properties</th></tr>'];
		rows.push('<tr class="general">');
		rows.push(stringFormat.call('<td title="{0}"><div>{0}</div></td>', options.lang.propertygrid.title));
		rows.push('<td><input type="text" id="title" value="', options.data.title, '" onchange="$(\'#', options.id, '\').flowchart(\'setTitle\', this.value = (this.value || this.defaultValue))"/></td>');
		rows.push('</tr>');
		rows.push('<tr class="general">');
		rows.push(stringFormat.call('<td title="{0}"><div>{0}</div></td>', options.lang.propertygrid.remarks));
		rows.push('<td><input type="text" id="remarks" value="', options.data.remarks, '" onchange="$(\'#', options.id, '\').data(\'flowchart\').options.data.remarks = this.value;"/></td>');
		rows.push('</tr>');
		rows.push('<tr class="general">');
		rows.push(stringFormat.call('<td title="{0}"><div>{0}</div></td>', options.lang.propertygrid.creator));
		rows.push('<td><input type="text" id="creator" value="', options.data.creator, '" readonly="readonly"/></td>');
		rows.push('</tr>');
		rows.push('<tr class="general">');
		rows.push(stringFormat.call('<td title="{0}"><div>{0}</div></td>', options.lang.propertygrid.created));
		rows.push('<td><input type="text" id="created" value="', options.data.created, '" readonly="readonly"/></td>');
		rows.push('</tr>');
		rows.push('<tr class="general">');
		rows.push(stringFormat.call('<td title="{0}"><div>{0}</div></td>', options.lang.propertygrid.modifier));
		rows.push('<td><input type="text" id="modifier" value="', options.data.modifier, '" readonly="readonly"/></td>');
		rows.push('</tr>');
		rows.push('<tr class="general">');
		rows.push(stringFormat.call('<td title="{0}"><div>{0}</div></td>', options.lang.propertygrid.modified));
		rows.push('<td><input type="text" id="modified" value="', options.data.modified, '" readonly="readonly"/></td>');
		rows.push('</tr>');
		rows.push('<tr class="general">');
		rows.push(stringFormat.call('<td title="{0}"><div>{0}</div></td>', options.lang.propertygrid.version));
		rows.push('<td><input type="text" id="version" value="', options.data.version, '" readonly="readonly"/></td>');
		rows.push('</tr>');
		options.ui.propertyGrid.children('tbody').prepend(rows.join('')).on('focus', 'input,textarea,select', function(event){
			var contents = String(options.lang.propertygrid[this.id]);
			if (options.shapeSet[this.value]) {
				contents += '（' + options.shapeSet[this.value] + '）';
			} else if (options.lang[this.value]) {
				contents += '（' + options.lang[this.value] + '）';
			} else {
				contents += '：' + (this.type == 'checkbox' ? this.checked : this.multiple ? $(this).children('optgroup').map(function(){ return this.label + '[' + $(this).children('option').not(':disabled').map(function(){ return this.text }).get().join(',') + ']' }).get().join(' ') : this.value);
			}
			options.ui.propertyGridFooter.delay(1000).html(contents);
		}).on('blur', 'input,textarea,select', function(event){
			options.ui.propertyGridFooter.delay(1000).html(options.lang.propertygrid.tips);
		}).on('change', 'input,textarea,select', function(event){
			var x = $(this).blur().focus().closest('tbody').find('#id').val();
			if (x && !this.onchange) {
				x = options.data.nodeSet[x] || options.data.lineSet[x];
				x && (x.extras[this.id] = this.type == 'checkbox' ? this.checked : this.multiple ? $(this).children('optgroup').map(function(){ return $(this).attr('value') + '-' + $(this).children('option').not(':disabled').map(function(){ return this.text + ':' + this.value }).get().join(',') }).get().join('|') : this.value);
			}
		}).on('click', 'button', function(event){
			editPropertyGrid(jq, options, $(this).siblings('[id]').attr('id'));
		});
	};

	function renderPropertyGrid(jq, options, key) {
		if (options.propertyGrid.visible && /^remove|^(blurTo|focusTo)$/g.test(arguments.callee.caller.arguments[0])) {
			key = key || options.activeNode;
			var tbody = options.ui.propertyGrid.children('tbody');
			if (key && arguments.callee.caller.arguments[0] == 'focusTo') {
				for (var item in options.data) {
					if (item = options.data[item][key]) {
						if (tbody.attr('uptime') !== (key = hash(item))) {
							var extras = (item.extras || (item.extras = {})), rows = ['<tr class="active"><th colspan="2" class="no-top-border">', (item.kind == 'line' ? 'Line' : 'Node'), ' Properties</th></tr>'];
							$.each(item, function(k, v){ v !== extras && rows.push(stringFormat.call('<tr class="active"><td title="{0}"><div>{0}</div></td><td><input type="text" id="{1}" value="{2}" readonly="readonly"/></td></tr>', options.lang.propertygrid[k], k, v)); });
							if (item.kind == 'line') {
								rows.push('<tr class="active extra precondition legend"><th colspan="2">Config extras of line</th></tr>');
								rows.push(stringFormat.call('<tr class="active extra precondition"><td title="{0}"><div>{0}</div></td><td><textarea id="precondition" readonly="readonly"></textarea><button>&#133;</button></td>', options.lang.propertygrid.precondition));
							} else {
								rows.push('<tr class="active extra script legend"><th colspan="2">Config processor of node</th></tr>');
								rows.push(stringFormat.call('<tr class="active extra script"><td title="{0}"><div>{0}</div></td><td><select id="type"><option value="1">UserTask</option><option value="2">ServiceTask</option><option value="4">ManualTask</option><option value="8">ReceiveTask</option></select></td>', options.lang.propertygrid.type));
								rows.push(stringFormat.call('<tr class="active extra script"><td title="{0}"><div>{0}</div></td><td><select id="language"><option value="1">BeanShell</option><option value="2">Groovy</option><option value="4">JavaScript</option><option value="8">SQL</option></select></td>', options.lang.propertygrid.language));
								rows.push(stringFormat.call('<tr class="active extra script"><td title="{0}"><div>{0}</div></td><td><textarea id="script" readonly="readonly"></textarea><button>&#133;</button></td>', options.lang.propertygrid.script));
								rows.push('<tr class="active extra actors legend"><th colspan="2">Config actor of node</th></tr>');
								rows.push(stringFormat.call('<tr class="active extra actors"><td title="{0}"><div>{0}</div></td><td><select id="series"><option value="1">Role</option><option value="2">User</option><option value="4">Organization</option></select></td>', options.lang.propertygrid.series));
								rows.push(stringFormat.call('<tr class="active extra actors"><td title="{0}"><div>{0}</div></td><td><select id="respond"><option value="0">Any</option><option value="1">All</option></select></td>', options.lang.propertygrid.respond));
								rows.push(stringFormat.call('<tr class="active extra actors"><td title="{0}"><div>{0}</div></td><td><select id="actors" multiple="multiple" readonly="readonly"><optgroup label="Roles" value="1"><option disabled="disabled">&lt;None&gt;</option></optgroup><optgroup label="Users" value="2"><option disabled="disabled">&lt;None&gt;</option></optgroup><optgroup label="Organizations" value="4"><option disabled="disabled">&lt;None&gt;</option></optgroup></select><button>&#133;</button></td>', options.lang.propertygrid.actors));
								rows.push('<tr class="active extra"><th colspan="2">Config extras of node</th></tr>');
								$.each(['fallback', 'circulative', 'countersign', 'transferable', 'suspendable', 'terminable'], function(i, v){ rows.push(stringFormat.call('<tr class="active"><td title="{0}"><div>{0}</div></td><td><input type="checkbox" class="w16h16" id="{1}"/></td>', options.lang.propertygrid[v], v)) });
							}
							tbody.attr('uptime', key).prepend(rows.join(''));
							$('#general-caption').removeClass('no-top-border');
							fillPropertyGrid(jq, options, tbody, extras);
						}
						return true;
					}
				}
			} else {
				tbody.find('tr.extra').find('input,select').trigger('change');
				tbody.removeAttr('uptime').find('tr.active').remove();
				$('#general-caption').addClass('no-top-border');
			}
		}
		return false;
	};

	function editPropertyGrid(jq, options, ids) {
		if (!options.propertyGrid.visible) {
			return false;
		}
		var tbody = options.ui.propertyGrid.children('tbody'), rows = [], x, dialog;
		x = tbody.find('#id').val();
		x = options.data.nodeSet[x] || options.data.lineSet[x];
		if (ids === void 0) {
			ids = tbody.find('button').map(function(){ return $(this).siblings('[id]').attr('id') });
			if (ids.length) {
				ids = ids.get().join(',tr.');
			}
		}

		rows.push('<form id="pgForm">')
		rows.push('<table id="pgTable">');
		rows.push('<col/>');
		rows.push('<col/>');
		rows.push('<tbody>');
		tbody.children('tr.' + ids).each(function(){ rows.push(Graphics.Api.outerHTML(this)) });
		rows.push('</tbody>');
		rows.push('</table>');
		rows.push('</form>');

		dialog = openDialog(jq, options, {
			title: 'Edit「' + x.text + '」', 
			content: rows.join(''), 
			onRestore: function(){
				this.content.find('#datacntr,#tips').width('');
				this.content.find('input,select,textarea,#datatool').css({ width: '', height: '' });
				return true;
			},
			onMaximize: function(){
				var width = Math.ceil((this.width() - this.content.find('#pgTable').width()) / 2);
				var candidate = Math.ceil(this.content.find('textarea').width('+=' + Math.ceil(width * 0.45)).height('180px').width() * 0.45);
				if (candidate) {
					this.content.find('#actors').add('#datacntr>#datalist,#datacntr>#datatool').height('180px');
				} else {
					this.content.find('#actors').add('#datacntr>#datalist,#datacntr>#datatool').height('180px').closest('#datacntr').width(width);
				}
				this.content.find('#tips').width('auto');
				return true;
			},
			buttons: [{
				text: 'Save configuration changes',
				onclick: function(){
					if (document.forms.length) {
						x = document.forms['pgForm'].elements;
						for (var i = 0, elem; i < x.length; i++) {
							elem = tbody.find('#' + x[i].id);
							if (elem.length) {
								if (x[i].multiple) {
									elem.html(x[i].innerHTML);
								} else {
									elem.val(x[i].value);
								}
								elem.trigger('change');
							}
						}
					}
					dialog.close();
				}
			}, {
				text: 'Cancel',
				onclick: function(){
					dialog.close();
				}
			}]
		});
		dialog.content.find('#pgTable').find('button').remove();
		dialog.content.find('[readonly]').removeAttr('readonly');
		dialog.content.find('#actors').before('<p id="tips">Plase click buttons in the middle, using option transfer select.<br/>[&#8660;] will filtering listbox on remote and local.<br/>[&gt;&gt;] or [&lt;&lt;] will moving selected options from one listbox to another listbox.</p><select id="datalist" multiple="multiple"><option disabled="disabled">&lt;None&gt;</option></select><table id="datatool" cellpadding="0" cellspacing="0"><tr><td><button id="query">&#8660;</button></td></tr><tr><td><button id="east">&gt;&gt;</button></td></tr><tr><td><button id="west">&lt;&lt;</button></td></tr></table>').closest('td').attr('id', 'datacntr');
		dialog.content.find('#datatool').find('button').bind('click', function(event){
			event.preventDefault();
			if (this.id == 'query') {
				var cssStyle = $.extend({}, $(this).position()), btnWidth = $(this).outerWidth(), filter = $('<input type="text" placeholder="Filter while typing" id="datafilter"/>').css(cssStyle).data('xfilter', Math.floor($(this).offset().left + btnWidth / 2) >= event.pageX).appendTo(dialog);
				filter.css({ height: $(this).outerHeight(true) - (filter.outerHeight(true) - filter.height()), left: (filter.data('xfilter') ? cssStyle.left - filter.outerWidth() + 1 : cssStyle.left + btnWidth - 1) });
				filter.bind('keyup', function(event){
					var qs = filter.val();
					if (qs != filter.data('qs')) {
						if (filter.data('qs', qs).data('xfilter')) {
							/* QUERY REMOTE */
						} else {
							dialog.content.find('#actors').find('option').not(':disabled').prop('selected', false).filter(':contains("' + qs + '")').prop('selected', true);
						}
					}
				}).focus();
				window.onresize = document.onmouseup = function(event){
					event = event || window.event;
					!filter.is(event.target || event.srcElement) && filter.remove() && (window.onresize = document.onmouseup = null);
				};
				dialog.content.off('scroll').on('scroll', document.onmouseup);
			} else {
				var seriesSelector = ('optgroup[value="' + dialog.content.find('#series').val() + '"]'), inlist, outlist, iter;
				if (this.id == 'east') {
					inlist = dialog.content.find('#actors').children(seriesSelector);
					iter = outlist = dialog.content.find('#datalist');
				} else if (this.id == 'west') {
					inlist = dialog.content.find('#datalist');
					iter = dialog.content.find('#actors');
					outlist = iter.children(seriesSelector);
				}
				for (var x = iter[0], i = x.length - 1, opts = []; i >= 0; i--) {
					if (x.options[i].selected) {
						opts.push('<option value="', x.options[i].value, '">', x.options[i].text, '</option>');
						x.remove(x.options[i].index);
					}
				}
				opts.length && inlist.append(opts.join('')).length && $.each([inlist, outlist], function(){
					this.children('option').not(':disabled').length ? this.children('option:disabled').remove() : this.prepend('<option disabled="disabled">&lt;None&gt;</option>');
				});
			}
		});
		fillPropertyGrid(jq, options, dialog.content, x.extras);
	};

	function fillPropertyGrid(jq, options, cntr, data) {
		if (data) {
			var elem, x, y, i, j, k;
			for (x in data) {
				elem = cntr.find('#' + x);
				if (elem.length && elem.val(data[x]).val() != data[x]) {
					/* special handling */
					if (x == 'actors') {
						x = data[x].split('|');
						for (i = 0, k = []; i < x.length; i++) {
							if (x[i].indexOf(',') > 0) {
								y = x[i].split(/-|:|,/g);
								for (j = y.length - 1; j > 0;) {
									k.push('<option value="', y[j--], '">', y[j--], '</option>');
								}
								k.length && elem.children('optgroup[value="' + y[j] + '"]').html(k.join(''));
							}
						}
					}
				}
			}
		}
	};

	function loadDataFromRepository(jq, options, param) {
		if (typeof(options.dataRepository) == 'string') {
			$.ajax({ type: options.method || 'get', url: options.dataRepository, data: param, dataType: 'json', success: function(data){
					$.isArray(data) ? jq.flowchart('loadRepository', data) : this.error();
				}, error: function(){
					options.ui.infobar.text(options.lang['load.error'] + ': ' + options.dataRepository).stop(true, true).fadeIn().delay(3000).fadeOut();
				}, before: function(){
					mask(jq, options);
				}, complete: function(){
					unmask(jq);
				}
			});
			return true;
		} else if ($.isArray(options.dataRepository)) {
			jq.flowchart('loadRepository', options.dataRepository);
			return true;
		}
	};

	function openJSONViewer(jq, options) {
		var resize = function(){
			var viewer = this.content.css('overflow', 'hidden').children('textarea'), offsetWidth = viewer.outerWidth(true) - viewer.width(), offsetHeight = viewer.outerHeight(true) - viewer.height();
			viewer.width(this.content.innerWidth() - offsetWidth).height(this.content.innerHeight() - offsetHeight);
		};
		return openDialog(jq, options, {
			title: 'Flow Chart Viewer', content: '<textarea class="json-viewer">' + jq.flowchart('getData') + '</textarea>', onMaximize: resize, onRestore: resize
		});
	};

	function openEditor(jq, options, x, y, text, kind, key) {
		x -= parseFloat(options.ui.editor.css('padding-left')) + parseFloat(options.ui.editor.css('border-left-width'));
		y -= parseFloat(options.ui.editor.css('padding-top')) + parseFloat(options.ui.editor.css('border-top-width'));
		options.ui.editor.val(text.text()).data({ key: (options.activeNode || key), kind: kind }).show();
		var bbox = text.bbox();
		options.ui.editor.css({ width: bbox.width + 32, height: bbox.height, left: x, top: y });
	};

	function closeEditor(jq, options) {
		if (options.ui.editor.is(':visible')) {
			jq.flowchart('stereotype', { id: options.ui.editor.data('key'), text: options.ui.editor.val(), kind: options.ui.editor.data('kind') });
			options.ui.editor.removeData('key').removeData('kind').val('').hide();
		}
	};

	function openDialog(jq, options, param) {
		mask(jq, options);
		var dialog = $('<div class="flowchart-dialog"><div class="dialog-header"><div class="title">' + (param.title || 'Untitled dialog') + '</div><div class="action"><i class="icon-restore"></i><i class="icon-close"></i></div></div><div class="dialog-content"></div><div class="dialog-footer"></div></div>').appendTo(jq);
		dialog.header = dialog.children('div.dialog-header');
		dialog.content = dialog.children('div.dialog-content');
		dialog.footer = dialog.children('div.dialog-footer');
		var minus = dialog.header.outerHeight(true);
		if (param) {
			if (param.href) {
				dialog.content.html('<iframe src="' + param.href + '" width="100%" height="100%"></iframe>');
			} else if (param.content) {
				dialog.content.html(param.content);
			}
			if (param.buttons) {
				minus += dialog.footer.outerHeight(true);
				$.each(param.buttons, function(i, v){
					$('<button>').text(v.text || 'button' + i).bind('click', $.isFunction(v.onclick) ? v.onclick : $.noop).appendTo(dialog.footer);
				});
			} else {
				dialog.footer.hide();
			}
		}
		dialog.close = function(){
			dialog.header.find('i.icon-close').click();
		};
		dialog.maximize = function(){
			dialog.header.find('i.icon-maximize').click();
			return dialog;
		};
		dialog.restore = function(){
			dialog.header.find('i.icon-restore').click();
			return dialog;
		};
		return dialog.on('click', 'i', function(event){
			var that = $(event.target), width = jq.outerWidth(), height = jq.outerHeight(), elemPos = Graphics.Api.coordinate(options.ui.canvas[0]), cssStyle, maximized;
			if (that.hasClass('icon-restore')) {
				that.removeClass('icon-restore').addClass('icon-maximize');
				cssStyle = { width: 600 + dialog.outerWidth() - dialog.innerWidth(), height: 400 + dialog.outerHeight() - dialog.innerHeight() };
				cssStyle.left = (width + elemPos.left) / 2 - cssStyle.width / 2;
				cssStyle.top = (height + elemPos.top) / 2 - cssStyle.height / 2;
			} else if (that.hasClass('icon-maximize')) {
				that.removeClass('icon-maximize').addClass('icon-restore');
				cssStyle = jq.offset();
				cssStyle.left += Math.round(width * 0.1);
				cssStyle.top += Math.round(height * 0.1);
				cssStyle.width = Math.round(width * 0.8);
				cssStyle.height = Math.round(height * 0.8);
				maximized = 1;
			} else if (that.hasClass('icon-close')) {
				if ($.isFunction(param.onClose) && !param.onClose.call(dialog)) {
					return false;
				}
				dialog.remove();
				unmask(jq);
			}
			if (cssStyle) {
				dialog.css(cssStyle);
				dialog.content.height(cssStyle.height - minus);
				maximized ? ($.isFunction(param.onMaximize) && param.onMaximize.call(dialog)) : ($.isFunction(param.onRestore) && param.onRestore.call(dialog));
			}
		}).restore();
	};

	function toggleScrollButton(jq, options) {
		if (options.ui.buttonbar.height() < options.ui.buttonbarDiv.height()) {
			var top = options.ui.buttonbar.offset().top;
			options.ui.buttonbarUp.css('top', top - options.ui.buttonbarUp.innerHeight()).show();
			options.ui.buttonbarDown.css('top', top + options.ui.buttonbar.height() - options.ui.buttonbarDown.height()).show();
		} else {
			options.ui.buttonbarUp.add(options.ui.buttonbarDown).hide();
			options.ui.buttonbarDiv.css('margin-top', '');
		}
	};

	function getImageBoundingBox(options) {
		var bbox = { x: options.canvas.panelWidth, y: options.canvas.panelHeight, width: 0, height: 0 }, padding = 32;
		for (var data in options.data.nodeSet) {
			data = options.data.nodeSet[data];
			bbox.x = Math.min(bbox.x, data.left);
			bbox.y = Math.min(bbox.y, data.top);
			bbox.width = Math.max(bbox.width, data.left + data.width);
			bbox.height = Math.max(bbox.height, data.top + data.height);
		}
		for (var data in options.data.lineSet) {
			data = options.data.lineSet[data];
			if (data.mid) {
				if (data.style == 'l2r') {
					bbox.x = Math.min(bbox.x, data.mid);
					bbox.width = Math.max(bbox.width, data.mid);
				} else if (data.style == 'b2t') {
					bbox.y = Math.min(bbox.y, data.mid);
					bbox.height = Math.max(bbox.height, data.mid);
				}
			}
		}
		bbox.x = Math.max(bbox.x - padding, 0);
		bbox.y = Math.max(bbox.y - padding, 0);
		bbox.width = Math.max(bbox.width + padding, 0);
		bbox.height = Math.max(bbox.height + padding, 0);
		bbox.x = Math.min(bbox.x, bbox.width);
		bbox.y = Math.min(bbox.y, bbox.height);
		return bbox;
	}

	function calcOverlapPoint(ds, x, y) {
		for (var item in ds) {
			if (ds[item].left == x && ds[item].top == y) {
				x += 16;
				y += 16;
			}
		}
		return { left: x, top: y };
	};

	function calcKnobXPoint(n1, n2, from, to) {
		var points = [], lx = to[0] - from[0], ly = to[1] - from[1], len = Math.sqrt(lx * lx + ly * ly);
		if (n1.shape == 'round') {
			var radius = n1.width / 2, cx = n1.left + radius, cy = n1.top + radius, dx, dy;
			for (var i = 0, j = Math.PI * 2, k = 1 / radius; i < j; i += k) {
				dx = Math.sin(i) * radius + cx;
				dy = Math.cos(i) * radius + cy;
				points.push(dx, dy);
			}
		} else {
			var dx = n1.left + n1.width, dy = n1.top + n1.height;
			for (var i = n1.left; i <= dx; i++) {
				points.push(i, n1.top, i, dy);
			}
			for (var i = n1.top; i <= dy; i++) {
				points.push(n1.left, i, dx, i);
			}
		}
		for (var i = 0, j, x, y, dx, dy, p; i < len; i++) {
			j = i / len;
			x = Math.round(from[0] + lx * j);
			y = Math.round(from[1] + ly * j);
			for (p = 0; p < points.length;) {
				dx = points[p++];
				dy = points[p++];
				if (x == dx && y == dy) {
					return [x, y];
				} else if (dx - 1 <= x && dx + 1 >= x && dy - 1 <= y && dy + 1 >= y) {
					return [x - 1, y - 1];
				}
			}
		}
	};

	function calcLine2D(options, n1, n2) {
		var offset = Graphics.Api.coordinate(options.ui.canvas[0]), 
			left = offset.left + options.ui.canvasCNTR.scrollLeft(), 
			top = offset.top + options.ui.canvasCNTR.scrollTop(), 
			cx1 = left + n1.left + n1.width / 2, 
			cy1 = top + n1.top + n1.height / 2, 
			halfW2 = n2.width / 2, 
			halfH2 = n2.height / 2, 
			cx2 = left + n2.left + halfW2, 
			cy2 = top + n2.top + halfH2, 
			points = [];
		if (n2.shape == 'rhombus') {
			points.push({ x: cx2, y: 0 - (cy2 - halfH2) });
			points.push({ x: cx2 + halfW2, y: 0 - cy2 });
			points.push({ x: cx2, y: 0 - (cy2 + halfH2) });
			points.push({ x: cx2 - halfW2, y: 0 - cy2 });
		} else {
			points.push({ x: cx2 - halfW2, y: 0 - (cy2 - halfH2) });
			points.push({ x: cx2 + halfW2, y: 0 - (cy2 - halfH2) });
			points.push({ x: cx2 + halfW2, y: 0 - (cy2 + halfH2) });
			points.push({ x: cx2 - halfW2, y: 0 - (cy2 + halfH2) });
		}
		var a = { x: cx1, y: 0 - cy1 }, b = { x: cx2, y: 0 - cy2 }, c, d, pairs = [0, 1, 1, 2, 2, 3, 3, 0];
		for (var i = 0; i < pairs.length;) {
			c = points[pairs[i++]];
			d = points[pairs[i++]];
			var abc = (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x);
			var abd = (a.x - d.x) * (b.y - d.y) - (a.y - d.y) * (b.x - d.x);
			if (abc * abd > 0) {
				continue;
			}
			var cda = (c.x - a.x) * (d.y - a.y) - (c.y - a.y) * (d.x - a.x);
			var cdb = cda + abc - abd;
			if (cda * cdb > 0) {
				continue;
			}
			var cp = cda / (abd - abc);
			return { p1: { x: cx1 - left, y: cy1 - top }, p2: { x: parseInt(a.x + cp * (b.x - a.x)) - left, y: 0 - parseInt(a.y + cp * (b.y - a.y)) - top } };
		}
	}

	function calcPolyLine2D(n1, n2, line) {
		var line2d = { x1: n1.left + n1.width / 2, y1: n1.top + n1.height / 2, x2: n2.left + n2.width / 2, y2: n2.top + n2.height / 2 }, 
			polyLine2D = { p1: { x: line2d.x1, y: line2d.y1 }, p2: { x: line2d.x2, y: line2d.y2 }, m1: {}, m2: {} };
		if (line.style == 'b2t') {
			polyLine2D.m2.y = polyLine2D.m1.y = Math.round(line.mid);
			polyLine2D.m1.x = line2d.x1;
			polyLine2D.m2.x = line2d.x2;
			/* start to middle */
			if (polyLine2D.m1.y > n1.top && polyLine2D.m1.y < n1.top + n1.height) {
				polyLine2D.p1.x = polyLine2D.m1.x = (line2d.x1 > line2d.x2 ? n1.left : n1.left + n1.width);
				polyLine2D.p1.y = polyLine2D.m1.y;
			} else {
				polyLine2D.p1.y = (polyLine2D.m1.y < n1.top ? n1.top : n1.top + n1.height);
			}
			/* middle to end */
			if (polyLine2D.m2.y > n2.top && polyLine2D.m2.y < n2.top + n2.height) {
				polyLine2D.p2.x = polyLine2D.m2.x = (line2d.x1 > line2d.x2 ? n2.left + n2.width : n2.left);
				polyLine2D.p2.y = polyLine2D.m2.y;
			} else {
				polyLine2D.p2.y = (polyLine2D.m2.y < n2.top ? n2.top : n2.top + n2.height);
			}
		} else if (line.style == 'l2r') {
			polyLine2D.m2.x = polyLine2D.m1.x = Math.round(line.mid);
			polyLine2D.m1.y = line2d.y1;
			polyLine2D.m2.y = line2d.y2;
			/* start to middle */
			if (polyLine2D.m1.x > n1.left && polyLine2D.m1.x < n1.left + n1.width) {
				polyLine2D.p1.x = polyLine2D.m1.x;
				polyLine2D.p1.y = polyLine2D.m1.y = (line2d.y1 > line2d.y2 ? n1.top : n1.top + n1.height);
			} else {
				polyLine2D.p1.x = (polyLine2D.m1.x < n1.left ? n1.left : n1.left + n1.width);
			}
			/* middle to end */
			if (polyLine2D.m2.x > n2.left && polyLine2D.m2.x < n2.left + n2.width) {
				polyLine2D.p2.x = polyLine2D.m2.x;
				polyLine2D.p2.y = polyLine2D.m2.y = (line2d.y1 > line2d.y2 ? n2.top + n2.height : n2.top);
			} else {
				polyLine2D.p2.x = (polyLine2D.m2.x < n2.left ? n2.left : n2.left + n2.width);
			}
		}
		return polyLine2D;
	};

	$.fn.flowchart = function(options, params) {
		if (typeof(options) == 'string') {
			var retval = $.fn.flowchart.methods[options](this, params);
			renderPropertyGrid(this, this.data('flowchart').options, $.isPlainObject(params) ? params.id : null);
			return retval;
		}
		options = options || {};
		return this.each(function(){
			if (!$.data(this, 'flowchart')) {
				$.data(this, 'flowchart', { options: $.extend(true, { ui: {} }, $.fn.flowchart.defaults, options), originalOptions: options });
			}
			initialize(this);
		});
	};

	$.fn.flowchart.methods = {
		undo: function(jq, params){
			return jq.each(function(){
				undo(jq, params);
			});
		},
		redo: function(jq, params){
			return jq.each(function(){
				redo(jq, params);
			});
		},
		clear: function(jq, params){
			return jq.each(function(){
				var data = jq.data('flowchart'), options = data.options, repos = options.dataRepository, unpin = options.propertyGrid.visible && options.ui.propertyGridCNTR.is(':hidden');
				options.ui = {};
				options.data.lineSet = {};
				options.data.nodeSet = {};
				options.buffer = $.extend(true, {}, $.fn.flowchart.defaults.buffer);
				options.buttonbar.items = data.originalOptions.buttonbar.items.concat();
				options.menubar.items = data.originalOptions.menubar.items.concat();
				options.dataRepository = options.activeButton = options.activeNode = options.initialized = null;
				initialize(jq.empty()[0], options);
				options.dataRepository = repos;
				unpin && jq.flowchart('togglePin', true);
			});
		},
		setTitle: function(jq, title){
			return jq.each(function(){
				var options = jq.data('flowchart').options;
				if (options.ui.menubar && title) {
					options.ui.menubar.children('label').attr('title', title).text(title);
					options.data.title = title;
				}
			});
		},
		getData: function(jq, id){
			var options = jq.data('flowchart').options;
			if (typeof(id) == 'string') {
				for (var key in options.data) {
					if (id in options.data[key]) {
						return Graphics.Api.stringify(options.data[key][id], options.indentMode);
					}
				}
			} else if (id === void 0 || id === null) {
				return Graphics.Api.stringify(options.data, options.indentMode);
			} else {
				return null;
			}
		},
		loadData: function(jq, data){
			return jq.each(function(){
				jq.flowchart('clear');
				var options = jq.data('flowchart').options, exp = /(\d+)\s*$/i, max = 0;
				if ($.isPlainObject(data)) {
					try {
						mask(jq, options);
						options.data.title = data.title;
						options.data.remarks = data.remarks;
						options.data.creator = data.creator;
						options.data.created = data.created;
						options.data.modifier = data.modifier;
						options.data.modified = data.modified;
						options.data.version = data.version;
						if (options.propertyGrid.visible) {
							options.ui.propertyGrid.find('#title').val(data.title).change();
							options.ui.propertyGrid.find('#remarks').val(data.remarks);
							options.ui.propertyGrid.find('#creator').val(data.creator);
							options.ui.propertyGrid.find('#created').val(data.created);
							options.ui.propertyGrid.find('#modifier').val(data.modifier);
							options.ui.propertyGrid.find('#modified').val(data.modified);
							options.ui.propertyGrid.find('#version').val(data.version);
						}
						jq.flowchart('setTitle', data.title);
						for (var item in data.nodeSet) {
							exp.test(data.nodeSet[item].id) && (max = Math.max(max, Number(RegExp.$1)));
							jq.flowchart('appendNode', data.nodeSet[item]);
						}
						for (var item in data.lineSet) {
							exp.test(data.lineSet[item].id) && (max = Math.max(max, Number(RegExp.$1)));
							jq.flowchart('appendLine', data.lineSet[item]);
						}
						options.serialNumber = ++max;
					} catch(e) {
						options.ui.infobar.text(options.lang['invalid.data'] + ': ' + e).stop(true, true).fadeIn().delay(3000).fadeOut();
					}
					unmask(jq);
				}
			});
		},
		loadRepository: function(jq, data){
			return jq.each(function(){
				var options = jq.data('flowchart').options, dialog, cls = (typeof(options.dataRepository) == 'string' ? '' : ' hide'), contents = ['<div class="data-filter"><input id="qs" type="text" placeholder="Search for flowchart"/><button class="reload', cls, '"/><button class="next', cls, '" data="1"/><button class="prev', cls, '" data="-1"/></div>'];
				for (var i = 0; i < data.length; i++) {
					contents.push('<span index="', i, '"><font color="blue">', data[i].title, '</font> - ', data[i].remarks, '（', data[i].created,'）</span>');
				}
				dialog = jq.children('div.flowchart-dialog');
				if (dialog.hasClass('loading')) {
					dialog.removeClass('loading').children('div.dialog-content').html(contents.join(''));
				} else {
					var param = { pageNumber: 0 };
					dialog = openDialog(jq, options, { title: 'Flowchart repository browser', content: contents.join('') });
					dialog.on('click', 'span[index]', function(event){
						jq.flowchart('loadData', options.buffer.repositories[$(event.target).attr('index')]);
					}).on('keyup', '#qs', function(event){
						param.qs = $.trim(this.value);
						if (param.qs.length || param.pageNumber) {
							if (param.qs.length && event.which != 13) {
								var list = dialog.content.find('span[index]');
								list.filter(function(){ return $(this).children('font').text().indexOf(param.qs) == -1 }).hide().length == list.length && options.ui.infobar.text(options.lang['not.match']).stop(true, true).fadeIn().delay(3000).fadeOut();
							} else if (!cls.length && event.which == 13) {
								dialog.addClass('loading');
								loadDataFromRepository(jq, options, param);
							}
						} else {
							dialog.content.find('span[index]').show();
						}
					}).on('click', 'button.reload', function(){
						$('#qs').trigger(jQuery.Event('keyup', { which: 13 }));
					}).on('click', 'button.prev,button.next', function(){
						param.pageIndex = (param.pageNumber += Number(this.getAttribute('data')));
						$('#qs').trigger(jQuery.Event('keyup', { which: 13 }));
					});
				}
				options.buffer.repositories = data;
			});
		},
		togglePin: function(jq, resizeable){
			return jq.each(function(){
				var options = jq.data('flowchart').options;
				if (!options.propertyGrid.visible) {
					return false;
				}
				var menu = options.ui.menubar.children('[item="pin"]'), width = parseFloat(options.ui.canvasCNTR.css('width')), elemPos = Graphics.Api.coordinate(options.ui.canvas[0]), offset = options.scrollbarWidth + 12;
				if (menu.hasClass('flowchart-menu1')) {
					menu.removeClass('flowchart-menu1').addClass('flowchart-menu0').children('i').removeClass('icon-pin').addClass('icon-unpin');
					options.ui.propertyGridCNTR.hide();
					if (resizeable) {
						options.ui.canvasCNTR.css('width', width += options.propertyGrid.width);
					}
				} else {
					menu.removeClass('flowchart-menu0').addClass('flowchart-menu1').children('i').removeClass('icon-unpin').addClass('icon-pin');
					options.ui.propertyGridCNTR.show();
					if (resizeable) {
						options.ui.canvasCNTR.css('width', width -= options.propertyGrid.width);
					}
				}
				options.ui.controller.css({ left: width + elemPos.left - offset - options.ui.controller.outerWidth(), top: options.canvas.height + elemPos.top - offset - options.ui.controller.outerHeight() })
			});
		},
		toggleButton: function(jq, button){
			return jq.each(function(){
				var options = jq.data('flowchart').options;
				options.ui.buttonbarDiv.children('#' + options.id + '-' + options.activeButton).removeClass('flowchart-button1').addClass('flowchart-button0');
				options.activeButton = button;
				options.ui.buttonbarDiv.children('#' + options.id + '-' + button).removeClass('flowchart-button0').addClass('flowchart-button1');
				if (button == 'marquee' || button == 'line') {
					jq.flowchart('blurTo');
				}
				options.ui.editor.filter(':visible').removeData('key').removeData('kind').val('').hide();
			});
		},
		highlight: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, data = options.data[params.kind + 'Set'][params.id], elem = Graphics.Api.adorn('#' + params.id);
				if (!data || data.marked || !elem.length || !options.onRestyle.call(jq, params)) {
					return false;
				}
				data.marked = params.marked || false;
				if (params.kind == 'node') {
					if (data.marked) {
						elem.addClass('highlight').css('border-color', options.cssStyle.highlightColor);
					} else {
						elem.removeClass('highlight').not('#' + options.activeNode).css('border-color', 'transparent');
					}
				} else if (params.kind == 'line') {
					if (Graphics.VML.supported) {
						elem.attr('strokeColor', data.marked ? options.cssStyle.highlightColor : options.cssStyle.lineColor);
					} else {
                        if (data.marked) {
							elem.css({ stroke: options.cssStyle.highlightColor, 'marker-end': 'url(#arrow2)' });
                        } else {
							elem.css({ stroke: options.cssStyle.lineColor, 'marker-end': 'url(#arrow1)' });
                        }
					}
				}
			});
		},
		focusTo: function(jq, params){
			return jq.each(function(){
				var options = jq.flowchart('blurTo').data('flowchart').options, elem = Graphics.Api.adorn('#' + params.id);
				if (!elem || !options.onFocus.call(jq, params) || options.activeNode) {
					return;
				}
				if (elem.is('g,div.flowchart-node')) {
					elem.addClass('focused').children('svg.hide,span.hide').show().end().first().attr('strokeColor', 'red');
					Graphics.Api.bringToFront(elem.parent().domElement());
				} else if (elem.is('svg,polyline,div')) {
					if (Graphics.VML.supported) {
						elem.first().attr('strokeColor', options.cssStyle.highlightColor);
					} else {
						elem.children('.subline').css({ stroke: options.cssStyle.highlightColor, 'marker-end': '#arrow2' });
					}
					if (options.canvas.editable) {
						var from = elem.attr('from').split(','), to = elem.attr('to').split(','), fromTo, data = options.data.lineSet[params.id];
						from = [parseInt(from[0], 10), parseInt(from[1], 10)];
						to = [parseInt(to[0], 10), parseInt(to[1], 10)];
						fromTo = from.concat(to);
						options.ui.splitter.data({ key: params.id, style: data.style });
						if (data.style == 'b2t') {
							to[1] = from[1] = data.mid;
							options.ui.splitter.css({ width: Math.abs(to[0] - from[0]), height: '4px', left: Math.min(from[0], to[0]), top: from[1] - 2, cursor: 's-resize' }).show();
						} else if (data.style == 'l2r') {
							to[0] = from[0] = data.mid;
							options.ui.splitter.css({ width: '4px', height: Math.abs(to[1] - from[1]), left: from[0] - 2, top: Math.min(from[1], to[1]), cursor: 'e-resize' }).show();
						}
						options.ui.widget.children('i').removeClass('selected').filter('[line=' + data.style + ']').addClass('selected');
						options.ui.widget.children('small').removeClass('selected').eq(Number(data.dashed)).addClass('selected');
						options.ui.widget.data('key', params.id).css({ left: (from[0] + to[0]) / 2 - options.ui.widget.outerWidth() / 2, top: (from[1] + to[1]) / 2 + options.ui.widget.outerHeight() / 2 }).show();
						options.ui.knob1.data('point', [fromTo[0], fromTo[1]]).css({ left: fromTo[0] - options.ui.knob1.outerWidth() / 2, top: fromTo[1] - options.ui.knob1.outerHeight() / 2 }).show();
						options.ui.knob2.data('point', [fromTo[2], fromTo[3]]).css({ left: fromTo[2] - options.ui.knob2.outerWidth() / 2, top: fromTo[3] - options.ui.knob2.outerHeight() / 2 }).show();
						options.ui.painter.appendChild(elem.domElement());
					}
				}
				options.activeNode = params.id;
				jq.flowchart('toggleButton', 'cursor');
			});
		},
		blurTo: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options;
				options.ui.canvas.find('g.focused,div.focused').each(function(){ Graphics.Api.adorn(this).removeClass('focused').first().removeAttr('strokeColor') });
				if (options.activeNode) {
					var elem = Graphics.Api.adorn('#' + options.activeNode);
					if (!elem || !options.onBlur.call(jq, params)) {
						return false;
					}
					if (elem.is('g,div.flowchart-node')) {
						elem.children('svg.show,span.show').hide();
					} else {
						options.ui.splitter.removeData('key').removeData('style').hide();
						if (!options.data.lineSet[options.activeNode].marked) {
							if (Graphics.VML.supported) {
								elem.first().attr('strokeColor', options.cssStyle.lineColor);
							} else {
								elem.children('.subline').css({ stroke: options.cssStyle.lineColor, 'marker-end': 'url(#arrow1)' });
							}
						}
						if (options.canvas.editable) {
							options.ui.widget.hide().removeData('key');
							options.ui.knob1.hide().removeData('point');
							options.ui.knob2.hide().removeData('point');
						}
					}
				}
				options.activeNode = null;
				return true;
			});
		},
		moveTo: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, data = options.data[params.kind + 'Set'][params.id];
				if (!data || !options.onMove.call(jq, params)) {
					return false;
				}
				var left = Math.max(params.left, 0), top = Math.max(params.top, 0);
				if (data.left != left || data.top != top) {
					Graphics.Api.adorn('#' + params.id).parent('svg,div').move(left, top);
					pushUndoStack('moveTo', { id: params.id, kind: params.kind, left: data.left, top: data.top, mid: data.mid });
					data.left = left;
					data.top = top;
					data.alt = options.canvas.editable;
					jq.flowchart('redrawLine', params);
				}
			});
		},
		resize: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, data = options.data[params.kind + 'Set'][params.id];
				if (!data || params.kind == 'initial' || params.kind == 'final' || !options.onResize.call(jq, params)) {
					return false;
				}
				if (data.left != params.left || data.top != params.top || data.width != params.width || data.height != params.height) {
					var elem = Graphics.Api.adorn('#' + params.id);
					elem.parent('svg,div').move(params.left, params.top).size(params.width, params.height);
					elem.last().updateUI();
					pushUndoStack('resize', { id: params.id, kind: params.kind, left: data.left, top: data.top, width: data.width, height: data.height });
					data.left = params.left;
					data.top = params.top;
					data.width = params.width;
					data.height = params.height;
					data.alt = options.canvas.editable;
					if (params.kind == 'node') {
						jq.flowchart('redrawLine', params);
					}
				}
			});
		},
		recolor: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, data = options.data[params.kind + 'Set'][params.id];
				if (params.color === 'default') {
					params.color = params.kind == 'line' ? options.cssStyle.lineColor : data.kind == 'process' ? options.cssStyle.processColor : options.cssStyle.nodeColor;
				} else if (params.color === 'random') {
					params.color = '#' + Graphics.Api.toHex(Math.round(Math.random() * 255), Math.round(Math.random() * 255), Math.round(Math.random() * 255));
				}
				if (options.colorMap[params.color] || Graphics.Api.isColor(params.color)) {
					var color = $('#color-' + params.color).length ? 'url(#color-' + params.color + ')' : params.color;
					Graphics.Api.adorn('#' + data.id).first().attr({ fill: color, fillcolor: color });
					pushUndoStack('recolor', { id: params.id, kind: params.kind, color: data.color });
					data.color = params.color;
				}
				data.alt = options.canvas.editable;
			});
		},
		removeNode: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, data = options.data.nodeSet[params.id];
				if (!data || !options.onRemove.call(jq, params)) {
					return false;
				}
				for (var item in options.data.lineSet) {
					if (params.id == options.data.lineSet[item].from || params.id == options.data.lineSet[item].to) {
						jq.flowchart('removeLine', { id: item, kind: 'line' });
					}
				}
				$('#' + params.id).parent().remove();
				delete options.data.nodeSet[params.id];
				if (options.activeNode == params.id) {
					options.activeNode = null;
				}
				pushUndoStack('appendNode', data);
				if (options.canvas.editable && params.id.indexOf(options.id + '-node') < 0) {
					options.buffer.recyclebin[params.id] = 'node';
				}
			});
		},
		appendNode: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, suffix = null;
				if (!params || !options.onAppend.call(jq, params)) {
					return false;
				}

				var btn = $('#' + options.id + '-' + params.kind), knownLen = options.ui.graphics.children('.' + params.kind).length + 1, minWidth = options.nodeWidth, minHeight = options.nodeHeight, aligning = undefined, fillBG;
				if (params.kind == 'initial' || params.kind == 'final') {
					if (knownLen > 1) {
						options.ui.infobar.text(options.lang['duplicate.data'] + ': ' + btn.attr('title')).stop(true, true).fadeIn().delay(3000).fadeOut();
						return false;
					}
					knownLen = '';
					aligning = 'xMidyBottom';
				} else if (params.kind == 'group') {
					params.color = params.color || options.colorMap.green;
					minWidth = options.groupWidth;
					minHeight = options.groupHeight;
					aligning = 'xMinyTop';
					fillBG = true;
				} else if (params.kind == 'decision') {
					params.color = params.color || options.cssStyle.highlightColor;
					aligning = 'xMidyBottom';
				} else if (params.kind == 'process') {
					params.color = params.color || options.cssStyle.processColor;
				} else {
					params.color = params.color || options.cssStyle.nodeColor;
				}
				if (params.color && !/^url/i.test(params.color) && $('#color-' + params.color).length) {
					params.color = 'url(#color-' + params.color + ')';
				}

				var shape = btn.attr('shape'), resizable = (shape != 'round' && shape != 'rhombus'), text = btn.attr('title') + knownLen;
				params = $.extend(true, { text: text, shape: shape, created: Graphics.Api.now() }, params);
				params.left = isNaN(params.left) ? 0 : Math.min(Math.max(params.left, 0), options.canvas.panelWidth - minWidth);
				params.top = isNaN(params.top) ? 0 : Math.min(Math.max(params.top, 0), options.canvas.panelHeight - minHeight);
				params.width = isNaN(params.width) ? (resizable ? minWidth : minHeight) : Math.max(params.width, (resizable ? minWidth : minHeight));
				params.height = isNaN(params.height) ? minHeight : Math.max(params.height, minHeight);

				var node = options.ui.graphics.nested().addClass(shape + ' ' + params.kind).size(params.width, params.height).move(params.left, params.top).css({ stroke: 'black', 'stroke-width': 2 });
				if (shape == 'round') {
					var oneHalf = params.width * 0.5, threeQuarters = params.width * 0.75, pos = (params.width - threeQuarters) * 0.5;
					if (params.kind == 'initial') {
						if (Graphics.VML.supported) {
							node.g().addClass('flowchart-node').circle(params.width, params.height).fill().shadow().stroke();
						} else {
							node.g().rect('100%','100%').rx(oneHalf).ry(oneHalf).attr('fill', 'url(#color-black)');
						}
					} else if (params.kind == 'final') {
						if (Graphics.VML.supported) {
							pos += pos * 0.2;
							document.createElement('')
							node.g().addClass('flowchart-node').circle(params.width, params.height).fill({ color: 'white' }).shadow().stroke().parent().nested().move(pos, pos).circle(threeQuarters, threeQuarters).fill().stroke();
						} else {
							node.g().attr('fill', '#FFF').rect('100%', '100%').rx(oneHalf).ry(oneHalf).parent().rect(threeQuarters, threeQuarters).rx(threeQuarters >> 1).ry(threeQuarters >> 1).move(pos, pos).attr('fill', 'url(#color-black)').css('stroke', 'black');
						}
					}
				} else if (shape == 'rhombus') {
					if (Graphics.VML.supported) {
						node.g().addClass('flowchart-node').rhombus(options.nodeHeight, options.nodeHeight).fill({ color: 'yellow' }).shadow().stroke();
					} else {
						node.g().rhombus(options.nodeHeight, options.nodeHeight).attr('fill', 'url(#color-yellow)');
					}
				} else {
					if (Graphics.VML.supported) {
						var g = node.g().addClass('flowchart-node');
						g.rect(params.width, params.height).fill({ color: params.color }).shadow().stroke();
						!fillBG && g.image('images/' + params.kind + '.png').size(24, 24).move(8, 8);
						g.nested('span').hide().move('100%', '50%').size(8, 8).css({ background: 'blue', position: 'absolute', 'z-index': 9999, cursor: 'e-resize' });
						g.nested('span').hide().move('50%', '100%').size(8, 8).css({ background: 'blue', position: 'absolute', 'z-index': 9999, cursor: 's-resize' });
						g.nested('span').hide().move('0%', '50%').size(8, 8).css({ background: 'blue', position: 'absolute', 'z-index': 9999, cursor: 'w-resize' });
						g.nested('span').hide().move('50%', '0%').size(8, 8).css({ background: 'blue', position: 'absolute', 'z-index': 9999, cursor: 'n-resize' });
						g.nested('span').hide().move('0%', '0%').size(8, 8).css({ background: 'blue', position: 'absolute', 'z-index': 9999, cursor: 'se-resize' });
						g.nested('span').hide().move('100%', '0%').size(8, 8).css({ background: 'blue', position: 'absolute', 'z-index': 9999, cursor: 'sw-resize' });
						g.nested('span').hide().move('0%', '100%').size(8, 8).css({ background: 'blue', position: 'absolute', 'z-index': 9999, cursor: 'ne-resize' });
						g.nested('span').hide().move('100%', '100%').size(8, 8).css({ background: 'blue', position: 'absolute', 'z-index': 9999, cursor: 'nw-resize' });
					} else {
						var g = node.attr('fill', params.color).g();
						g.rect('100%', '100%');
						!fillBG && g.image('images/' + params.kind + '.png').size(24, 24).move(8, 8);
						g.nested().hide().move('100%', '50%').rect(6, 6).rx(0).ry(0).css({ fill: 'blue', stroke: 'blue', cursor: 'e-resize' }).move(-3, -3);
						g.nested().hide().move('50%', '100%').rect(6, 6).rx(0).ry(0).css({ fill: 'blue', stroke: 'blue', cursor: 's-resize' }).move(-3, -3);
						g.nested().hide().move('0%', '50%').rect(6, 6).rx(0).ry(0).css({ fill: 'blue', stroke: 'blue', cursor: 'w-resize' }).move(-3, -3);
						g.nested().hide().move('50%', '0%').rect(6, 6).rx(0).ry(0).css({ fill: 'blue', stroke: 'blue', cursor: 'n-resize' }).move(-3, -3);
						g.nested().hide().move('0%', '0%').rect(6, 6).rx(0).ry(0).css({ fill: 'blue', stroke: 'blue', cursor: 'se-resize' }).move(-3, -3);
						g.nested().hide().move('100%', '0%').rect(6, 6).rx(0).ry(0).css({ fill: 'blue', stroke: 'blue', cursor: 'sw-resize' }).move(-3, -3);
						g.nested().hide().move('0%', '100%').rect(6, 6).rx(0).ry(0).css({ fill: 'blue', stroke: 'blue', cursor: 'ne-resize' }).move(-3, -3);
						g.nested().hide().move('100%', '100%').rect(6, 6).rx(0).ry(0).css({ fill: 'blue', stroke: 'blue', cursor: 'nw-resize' }).move(-3, -3);
					}
				}

				node.first().text(params.text, null, aligning, fillBG).parent().attr('id', function(id){ return params.id || (params.id = id) });

				if (params.marked) {
					node.addClass('highlight');
				}
				if (options.buffer.recyclebin[params.id]) {
					node.move(params.left, params.top);
				} else {
					op = calcOverlapPoint(options.data.nodeSet, params.left, params.top);
					node.move(params.left = op.left, params.top = op.top)
				}

				options.data.nodeSet[params.id] = params;
				options.data.nodeSet[params.id].alt = options.canvas.editable;
				pushUndoStack('removeNode', { id: params.id, kind: 'node' });
				if (options.canvas.editable && options.buffer.recyclebin[params.id]) {
					delete options.buffer.recyclebin[params.id];
				}
			});
		},
		setLineStyle: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, data = options.data.lineSet[params.id], elem = Graphics.Api.adorn('#' + params.id);
				if (!data || (!params.style && (params.dashed === undefined || params.dashed === null)) || (params.style && data.style == params.style) || !elem || !options.onRestyle.call(jq, params)) {
					return false;
				}
				var n1 = options.data.nodeSet[data.from], n2 = options.data.nodeSet[data.to];
				if (!n1 || !n2 || n1 == n2) {
					return false;
				}
				pushUndoStack('setLineStyle', { id: params.id, mid: data.mid, style: data.style, dashed: data.dashed });
				data.alt = options.canvas.editable;
				params.dashed !== undefined && (data.dashed = params.dashed);
				if (params.style) {
					data.style = params.style;
					if (params.style != 'sl') {
						if (!params.mid) {
							if (params.style == 'b2t') {
								params.mid = (n1.top + n1.height / 2 + n2.top + n2.height / 2) / 2;
							} else if (params.style == 'l2r') {
								if (n1.left + n1.width < n2.left) {
									params.mid = n1.left + n1.width + (n2.left - n1.left - n1.width) / 2;
								} else if (n2.left + n2.width < n1.left) {
									params.mid = n2.left + n2.width + (n1.left - n2.left - n2.width) / 2;
								} else {
									params.mid = (n1.left + n1.width / 2 + n2.left + n2.width / 2) / 2;
								}
							}
						}
						jq.flowchart('setLineMidpoint', { id: params.id, mid: params.mid, disableUndo: true, dashed: data.dashed });
					} else {
						delete data.mid;
						var line2d = calcLine2D(options, n1, n2);
						elem.remove();
						jq.flowchart('drawLine', { id: params.id, line: data, line2d: line2d, dashed: data.dashed });
						Graphics.Api.adorn('#' + params.id).last().text(data.text);
					}
				} else {
					if (Graphics.VML.supported) {
						elem.first().children('stroke').attr('dashStyle', data.dashed ? 'dash' : 'none');
					} else {
						elem.children('.subline').css('stroke-dasharray', data.dashed ? '5,5' : 'none');
					}
				}
				if (options.activeNode == params.id) {
					jq.flowchart('focusTo', { id: params.id, selection: false });
				}
			});
		},
		setLineMidpoint: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, data = options.data.lineSet[params.id], elem = Graphics.Api.adorn('#' + params.id);
				if (!data || data.style == 'sl' || !elem || !options.onRestyle.call(jq, params)) {
					return false;
				}
				if (!params.disableUndo) {
					pushUndoStack('setLineMidpoint', { id: params.id, mid: data.mid });
				}
				data.mid = params.mid;
				data.alt = options.canvas.editable;
				var line2d = calcPolyLine2D(options.data.nodeSet[data.from], options.data.nodeSet[data.to], data);
				elem.remove();
				jq.flowchart('drawPolyLine', { id: params.id, line: data, line2d: line2d });
				Graphics.Api.adorn('#' + data.id).last().text(data.text);
			});
		},
		relinkLine: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, data = options.data.lineSet[params.id], elem = Graphics.Api.adorn('#' + params.id);
				if (!data || !elem || !options.onRelink.call(jq, params)) {
					return false;
				} else if (params.from == params.to || (params.from == data.from && params.to == data.to)) {
					options.ui.infobar.text(options.lang['invalid.link']).stop(true, true).fadeIn().delay(3000).fadeOut();
					return false;
				}
				/* grep */
				params.from = params.from || data.from;
				params.to = params.to || data.to;
				for (var item in options.data.lineSet) {
					if (params.from == options.data.lineSet[item].from && params.to == options.data.lineSet[item].to) {
						options.ui.infobar.text(options.lang['repeating.link']).stop(true, true).fadeIn().delay(3000).fadeOut();
						return false;
					}
				}
				if (!params.disableUndo) {
					pushUndoStack('relinkLine', { id: params.id, from: data.from, to: data.to });
				}
				data.from = params.from || data.from;
				data.to = params.to || data.to;
				data.alt = options.canvas.editable;
				elem.remove();
				jq.flowchart('drawRouteLine', data);
			});
		},
		removeLine: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, data = options.data.lineSet[params.id], elem = Graphics.Api.adorn('#' + params.id);
				if (!data || !elem || !options.onRemove.call(jq, params)) {
					return false;
				}
				elem.remove();
				delete options.data.lineSet[params.id];
				if (options.activeNode == params.id) {
					options.activeNode = null;
				}
				pushUndoStack('appendLine', data);
				options.ui.widget.hide().removeData('key');
				if (options.canvas.editable) {
					options.ui.knob1.hide().removeData('point');
					options.ui.knob2.hide().removeData('point');
					if (params.id.indexOf(options.id + '-line') < 0) {
						options.buffer.recyclebin[params.id] = 'line';
					}
				}
			});
		},
		appendLine: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, n1 = options.data.nodeSet[params.from], n2 = options.data.nodeSet[params.to];
				if (!n1 || !n2 || n1 == n2 || !options.onAppend.call(jq, params)) {
					return false;
				} else if (n2.kind == 'note') {
					options.ui.infobar.text(options.lang['invalid.link']).stop(true, true).fadeIn().delay(3000).fadeOut();
					return false;
				}
				/* grep */
				for (var item in options.data.lineSet) {
					if (params.from == options.data.lineSet[item].from && params.to == options.data.lineSet[item].to) {
						options.ui.infobar.text(options.lang['repeating.link']).stop(true, true).fadeIn().delay(3000).fadeOut();
						return false;
					}
				}
				options.data.lineSet[params.id] = $.extend({ text: (options.lang.line + (options.ui.graphics.children('.line1').length + 1)), style: 'sl', kind: 'line', marked: false, dashed: false }, params);
				jq.flowchart('drawRouteLine', options.data.lineSet[params.id]);
				pushUndoStack('removeLine', { id: params.id, kind: 'line' });
				if (options.canvas.editable && options.buffer.recyclebin[params.id]) {
					delete options.buffer.recyclebin[params.id];
				}
			});
		},
		drawRouteLine: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, n1 = options.data.nodeSet[params.from], n2 = options.data.nodeSet[params.to];
				if (!n1 || !n2 || n1 == n2 || !options.onAppend.call(jq, params)) {
					return false;
				}
				/* calc */
				var line2d = (params.style != 'sl' ? calcPolyLine2D(n1, n2, params) : calcLine2D(options, n1, n2));
				/* draw */
				if (params.style != 'sl') {
					jq.flowchart('drawPolyLine', { id: params.id, line: params, line2d: line2d });
				} else {
					jq.flowchart('drawLine', { id: params.id, line: params, line2d: line2d });
				}
				/* adjusting */
				Graphics.Api.adorn('#' + params.id).last().text(params.text);
			});
		},
		drawLine: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, data = options.data.lineSet[params.id], from = [params.line2d.p1.x, params.line2d.p1.y], to = [params.line2d.p2.x, params.line2d.p2.y], noXLine = Number(params.id != XLINE), dashed = params.line.dashed || params.dashed, marked = params.line.marked || params.marked, node;
				if (data) {
					from = calcKnobXPoint(options.data.nodeSet[data.from], options.data.nodeSet[data.to], from, to)
				}

				node = options.ui.graphics.nested().attr({ id: params.id, from: from, to: to }).addClass('line' + noXLine);
				if (Graphics.VML.supported) {
					node.line(from[0], from[1], params.line2d.p2.x, params.line2d.p2.y).addClass('mainline').attr('fromTo', from.concat(to)).css('cursor', noXLine ? 'pointer' : 'crosshair')
						.stroke({ endArrow: 'open', dashStyle: (dashed ? 'dash' : 'none'), color: (marked ? options.cssStyle.highlightColor : options.cssStyle.lineColor) });
				} else {
					var cssStyle = { cursor: 'pointer', fill: 'none', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'pointer-events': 'none' };
					if (dashed) {
						cssStyle['stroke-dasharray'] = '5,5';
					}
					if (marked) {
						cssStyle['stroke'] = options.cssStyle.highlightColor;
						cssStyle['marker-end'] = 'url(#arrow2)';
					} else {
						cssStyle['stroke'] = options.cssStyle.lineColor;
						cssStyle['marker-end'] = 'url(#arrow1)';
					}
					node.line(from[0], from[1], params.line2d.p2.x, params.line2d.p2.y).addClass('mainline').css({ visibility: 'hidden', cursor: 'pointer', fill: 'none', 'stroke-width': '10', stroke: 'transparent', 'pointer-events': 'stroke' });
					node.line(from[0], from[1], params.line2d.p2.x, params.line2d.p2.y).addClass('subline').css(cssStyle);
				}
				node.text('', null, null, true);
				if (node.hasClass('line1')) {
					options.ui.painter.insertBefore(node.domElement(), options.ui.painter.firstChild);
				}
			});
		},
		drawPolyLine: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, points = [params.line2d.p1.x, params.line2d.p1.y], noXLine = Number(params.id != XLINE), dashed = params.line.dashed || params.dashed, marked = params.line.marked || params.marked, node;
				/* concat path */
				if (params.line2d.m1.x != params.line2d.p1.x || params.line2d.m1.y != params.line2d.p1.y) {
					points.push(params.line2d.m1.x, params.line2d.m1.y);
				}
				if (params.line2d.m2.x != params.line2d.p2.x || params.line2d.m2.y != params.line2d.p2.y) {
					points.push(params.line2d.m2.x, params.line2d.m2.y);
				}
				points.push(params.line2d.p2.x, params.line2d.p2.y);
				/* repaint line */
				var node = options.ui.graphics.nested().attr({ id: params.id, from: [params.line2d.p1.x, params.line2d.p1.y], to: [params.line2d.p2.x, params.line2d.p2.y] }).addClass('line' + noXLine);
				if (Graphics.VML.supported) {
					node.polyline(points).addClass('mainline').attr({ filled: 'false', fromTo: points }).css('cursor', 'pointer')
						.stroke({ endArrow: 'open', dashStyle: (dashed ? 'dash' : 'none'), color: (marked ? options.cssStyle.highlightColor : options.cssStyle.lineColor) });
				} else {
					var cssStyle = { cursor: 'pointer', fill: 'none', 'stroke-width': 1.4, 'stroke-linecap': 'round', 'pointer-events': 'none' };
					if (dashed) {
						cssStyle['stroke-dasharray'] = '5,5';
					}
					if (marked) {
						cssStyle['stroke'] = options.cssStyle.highlightColor;
						cssStyle['marker-end'] = 'url(#arrow2)';
					} else {
						cssStyle['stroke'] = options.cssStyle.lineColor;
						cssStyle['marker-end'] = 'url(#arrow1)';
					}
					node.polyline(points).addClass('mainline').css({ visibility: 'hidden', cursor: 'pointer', fill: 'none', 'stroke-width': '10', stroke: 'transparent', 'pointer-events': 'stroke' });
					node.polyline(points).addClass('subline').css(cssStyle);
				}
				node.text('', null, null, true);
				if (node.hasClass('line1')) {
					options.ui.painter.insertBefore(node.domElement(), options.ui.painter.firstChild);
				}
			});
		},
		redrawLine: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, current = options.data.nodeSet[params.id], another, line2d, data;
				for (var item in options.data.lineSet) {
					data = options.data.lineSet[item];
					if (another = (params.id == data.from ? data.to : (params.id == data.to ? data.from : null))) {
						if (another = options.data.nodeSet[another]) {
							/* SWAP */
							if (data.to == params.id) {
								line2d = current;
								current = another;
								another = line2d;
							}
							if (data.style != 'sl') {
								if (data.style == 'b2t') {
									data.mid = (current.top + current.height / 2 + another.top + another.height / 2) / 2;
								} else if (data.style == 'l2r') {
									if (current.left + current.width < another.left) {
										data.mid = current.left + current.width + (another.left - current.left - current.width) / 2;
									} else if (another.left + another.width < current.left) {
										data.mid = another.left + another.width + (current.left - another.left - another.width) / 2;
									} else {
										data.mid = (current.left + current.width / 2 + another.left + another.width / 2) / 2;
									}
								}
								line2d = calcPolyLine2D(current, another, data);
							} else {
								line2d = calcLine2D(options, current, another);
							}
							/* UNDO SWAP */
							if (another.id == params.id) {
								current = another;
							}
						}
					} else {
						continue;
					}
					/* redraw line */
					$('#' + item).remove();
					if (data.style != 'sl') {
						jq.flowchart('drawPolyLine', { id: item, line: data, line2d: line2d });
					} else {
						jq.flowchart('drawLine', { id: item, line: data, line2d: line2d });
					}
					/* adjusting */
					Graphics.Api.adorn('#' + data.id).last().text(data.text);
				}
			});
		},
		stereotype: function(jq, params){
			return jq.each(function(){
				var options = jq.data('flowchart').options, data = options.data[params.kind + 'Set'][params.id];
				if (!data || data.text == params.text || !options.onRename.call(jq, params)) {
					return false;
				}
				var stereotype = data.text;
				data.text = params.text;
				data.alt = options.canvas.editable;
				Graphics.Api.adorn('#' + data.id).last().text(data.text);
				pushUndoStack('stereotype', { id: params.id, text: stereotype, kind: params.kind });
			});
		}
	};

	$.fn.flowchart.defaults = {
		/*宽*/
		width: '100%',
		/*高*/
		height: '100%',
		/*节点宽*/
		nodeWidth: 160,
		/*节点高*/
		nodeHeight: 48,
		/*分组宽*/
		groupWidth: 320,
		/*分组高*/
		groupHeight: 96,
		/*撤消栈大小*/
		undoStackSize: 32,
		/*缩进模式*/
		indentMode: true,
		/*菜单栏*/
		menubar: {
			visible: true,
			items: ['new', 'open', 'save', 'reload', 'json', '-', 'undo', 'redo', '-', 'lock', 'pin']
		},
		/*按扭栏*/
		buttonbar: {
			visible: true,
			items: ['cursor', 'marquee', 'line', '-', {
				name: 'initial', shape: 'round'
			}, {
				name: 'final', shape: 'round'
			}, '-', {
				name: 'group', shape: 'roundRect'
			}, {
				name: 'note', shape: 'roundRect'
			}, '-', {
				name: 'action', shape: 'roundRect'
			}, {
				name: 'decision', shape: 'rhombus'
			}, {
				name: 'process', shape: 'roundRect'
			}, '-', {
				name: 'fork', shape: 'roundRect'
			}, {
				name: 'join', shape: 'roundRect'
			}]
		},
		/*右键菜单*/
		contextmenu: {
			visible: true,
			items: [{
				text: 'undo',
				disabled: false,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.ctrlKey = true;
					event.which = 90;
					$(document).trigger(event);
				}
			}, {
				text: 'redo',
				disabled: false,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.ctrlKey = true;
					event.which = 89;
					$(document).trigger(event);
				}
			}, '-', {
				text: 'edit',
				disabled: false,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.ctrlKey = true;
					event.which = 85;
					$(document).trigger(event);
				}
			}, {
				text: 'cut',
				disabled: false,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.ctrlKey = true;
					event.which = 88;
					$(document).trigger(event);
				}
			}, {
				text: 'copy',
				disabled: false,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.ctrlKey = true;
					event.which = 67;
					$(document).trigger(event);
				}
			}, {
				text: 'paste',
				disabled: false,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.ctrlKey = true;
					event.which = 86;
					$(document).trigger(event);
				}
			}, {
				text: 'selectAll',
				disabled: false,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.ctrlKey = true;
					event.which = 65;
					$(document).trigger(event);
				}
			}, {
				text: 'delete',
				disabled: false,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.ctrlKey = true;
					event.which = 68;
					$(document).trigger(event);
				}
			}, '-', {
				text: 'exportAsImg',
				disabled: Graphics.VML.supported,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.shiftKey = event.ctrlKey = true;
					event.which = 69;
					$(document).trigger(event);
				}
			}, {
				text: 'recolor',
				disabled: false,
				children: [{
					text: 'random',
					disabled: false,
					onclick: function(){
						var event = jQuery.Event('keydown');
						event.shiftKey = event.ctrlKey = true;
						event.which = 82;
						$(document).trigger(event);
					}
				}, '-', {
					text: 'default',
					disabled: false,
					onclick: function(){
						var event = jQuery.Event('keydown');
						event.shiftKey = event.ctrlKey = true;
						event.which = 49;
						$(document).trigger(event);
					}
				}, {
					text: 'red',
					disabled: false,
					onclick: function(){
						var event = jQuery.Event('keydown');
						event.shiftKey = event.ctrlKey = true;
						event.which = 50;
						$(document).trigger(event);
					}
				}, {
					text: 'green',
					disabled: false,
					onclick: function(){
						var event = jQuery.Event('keydown');
						event.shiftKey = event.ctrlKey = true;
						event.which = 51;
						$(document).trigger(event);
					}
				}, {
					text: 'blue',
					disabled: false,
					onclick: function(){
						var event = jQuery.Event('keydown');
						event.shiftKey = event.ctrlKey = true;
						event.which = 52;
						$(document).trigger(event);
					}
				}, {
					text: 'black',
					disabled: false,
					onclick: function(){
						var event = jQuery.Event('keydown');
						event.shiftKey = event.ctrlKey = true;
						event.which = 53;
						$(document).trigger(event);
					}
				}, {
					text: 'white',
					disabled: false,
					onclick: function(){
						var event = jQuery.Event('keydown');
						event.shiftKey = event.ctrlKey = true;
						event.which = 54;
						$(document).trigger(event);
					}
				}, {
					text: 'yellow',
					disabled: false,
					onclick: function(){
						var event = jQuery.Event('keydown');
						event.shiftKey = event.ctrlKey = true;
						event.which = 55;
						$(document).trigger(event);
					}
				}, {
					text: 'orange',
					disabled: false,
					onclick: function(){
						var event = jQuery.Event('keydown');
						event.shiftKey = event.ctrlKey = true;
						event.which = 56;
						$(document).trigger(event);
					}
				}, {
					text: 'gray',
					disabled: false,
					onclick: function(){
						var event = jQuery.Event('keydown');
						event.shiftKey = event.ctrlKey = true;
						event.which = 57;
						$(document).trigger(event);
					}
				}]
			}, '-', {
				text: 'bringForward',
				disabled: false,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.ctrlKey = true;
					event.which = 38;
					$(document).trigger(event);
				}
			}, {
				text: 'bringToFront',
				disabled: false,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.shiftKey = event.ctrlKey = true;
					event.which = 38;
					$(document).trigger(event);
				}
			}, {
				text: 'sendBackward',
				disabled: false,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.ctrlKey = true;
					event.which = 40;
					$(document).trigger(event);
				}
			}, {
				text: 'sendToBack',
				disabled: false,
				onclick: function(){
					var event = jQuery.Event('keydown');
					event.shiftKey = event.ctrlKey = true;
					event.which = 40;
					$(document).trigger(event);
				}
			}]
		},
		/*尺子*/
		ruler: {
			visible: true,
			scale: 10
		},
		/*国际化*/
		i18n: {
			'zh-CN': {
				/* i18n for menubar */
				'new': '新建', 
				'open': '打开', 
				'save': '保存', 
				'undo': '撤销（Ctrl+Z）', 
				'redo': '重做（Ctrl+Y）', 
				'reload': '重新载入', 
				'json': '显示源代码', 
				'lock': '滚动锁定/滚动解锁（流程编辑器）', 
				'pin': '固定/不固定（属性编辑器）', 
				/* i18n for contextmenu */
				'edit': '编辑（Ctrl+U）', 
				'cut': '剪切（Ctrl+X）', 
				'copy': '复制（Ctrl+C）', 
				'paste': '粘贴（Ctrl+V）', 
				'delete': '删除（Ctrl+D）', 
				'selectAll': '全选（Ctrl+A）', 
				'exportAsImg': '导出为图片（Ctrl+Shift+E）', 
				'recolor': '设置颜色', 
				'random': '随机（Ctrl+Shift+R）', 
				'default': '默认（Ctrl+Shift+1）', 
				'red': '红色（Ctrl+Shift+2）', 
				'green': '绿色（Ctrl+Shift+3）', 
				'blue': '蓝色（Ctrl+Shift+4）', 
				'black': '黑色（Ctrl+Shift+5）', 
				'white': '白色（Ctrl+Shift+6）', 
				'yellow': '黄色（Ctrl+Shift+7）', 
				'orange': '橙色（Ctrl+Shift+8）', 
				'gray': '灰色（Ctrl+Shift+9）', 
				'bringToFront': '将图层置顶（Ctrl+Shift+&#8593;）', 
				'bringForward': '将图层置前（Ctrl+&#8593;）', 
				'sendToBack': '将图层置底（Ctrl+Shift+&#8595;）', 
				'sendBackward': '将图层置后（Ctrl+&#8595;）', 
				/* i18n for buttonbar */
				'cursor': '光标', 
				'marquee': '选取框', 
				'line': '线条', 
				'note': '注释', 
				'group': '分组', 
				'action': '操作', 
				'initial': '初始节点', 
				'final': '结束节点', 
				'fork': '分叉节点', 
				'join': '联接节点', 
				'decision': '决策节点', 
				'process': '子流程节点', 
				/* i18n for widget */
				'sl': '直线连接', 
				'b2t': '折线连接（从下至上）', 
				'l2r': '折线连接（从左至右）', 
				'solid': '直线', 
				'dashed': '虚线', 
				'remove': '删除', 
				/* i18n for propertygrid */
				propertygrid: {
					'title': '标题', 
					'remarks': '备注', 
					'creator': '创建人', 
					'created': '创建时间', 
					'modifier': '修改人', 
					'modified': '修改时间', 
					'version': '版本号', 
					'text': '文本标签', 
					'shape': '图形形状', 
					'id': '唯一标识', 
					'left': '左边缘偏移', 
					'top': '上边缘偏移', 
					'kind': '图形种类', 
					'color': '图形背景色', 
					'width': '图形宽度', 
					'height': '图形高度', 
					'alt': '更新标识', 
					'tips': '暂无信息', 
					'style': '线条样式', 
					'marked': '高亮', 
					'dashed': '虚线', 
					'from': '来源节点', 
					'to': '目地节点', 
					'mid': '线条中心点',
					'precondition': '前置条件',
					'type': '任务类型',
					'language': '脚本语言',
					'script': '脚本代码',
					'series': '系列（人物/角色/组织机构）',
					'respond': '应答方式',
					'actors': '参与者',
					'fallback': '可回退',
					'circulative': '可传阅',
					'countersign': '可会签',
					'transferable': '可转办',
					'suspendable': '可中止',
					'terminable': '可终止'
				},
				/* i18n for errors */
				'loading.message': '正在玩命加载，请稍等...', 
				'invalid.link': '无效链路', 
				'invalid.data': '无效数据', 
				'invalid.repository': '没有指定远程存储库，请指定一个有效的URL', 
				'duplicate.data': '重复数据', 
				'not.match': '找不到匹配项', 
				'repeating.link': '重复链路', 
				'image.export': '图片导出失败', 
				'load.error': '无法从远程服务加载数据'
			},
			'en-US': {
				/* i18n for menubar */
				'new': 'New', 
				'open': 'Open', 
				'save': 'Save', 
				'undo': 'Undo（Ctrl+Z）', 
				'redo': 'Redo（Ctrl+Y）', 
				'reload': 'Reload File', 
				'reload': 'View Source', 
				'lock': 'Scroll Lock/Scroll UnLock（Workflow Editor）', 
				'pin': 'Pin/Unpin（Property Editor）', 
				/* i18n for contextmenu */
				'edit': 'Edit（Ctrl+U）', 
				'cut': 'Cut（Ctrl+X）', 
				'copy': 'Copy（Ctrl+C）', 
				'paste': 'Paste（Ctrl+V）', 
				'delete': 'Delete（Ctrl+D）', 
				'selectAll': 'Select All（Ctrl+A）', 
				'exportAsImg': 'Export as Image（Ctrl+Shift+E）', 
				'recolor': 'Set Color', 
				'random': 'Random（Ctrl+Shift+R）', 
				'default': 'Default（Ctrl+Shift+1）', 
				'red': 'Red（Ctrl+Shift+2）', 
				'green': 'Green（Ctrl+Shift+3）', 
				'blue': 'Blue（Ctrl+Shift+4）', 
				'black': 'Black（Ctrl+Shift+5）', 
				'white': 'White（Ctrl+Shift+6）', 
				'yellow': 'Yellow（Ctrl+Shift+7）', 
				'orange': 'Orange（Ctrl+Shift+8）', 
				'gray': 'Gray（Ctrl+Shift+9）', 
				'bringToFront': 'Bring to Front（Ctrl+Shift+&#8593;）', 
				'bringForward': 'Bring Forward（Ctrl+&#8593;）', 
				'sendToBack': 'Send to Back（Ctrl+Shift+&#8595;）', 
				'sendBackward': 'Send Backward（Ctrl+&#8595;）', 
				/* i18n for buttonbar */
				'cursor': 'Cursor', 
				'marquee': 'Marquee', 
				'line': 'Line', 
				'note': 'Note', 
				'group': 'Group', 
				'action': 'Action', 
				'initial': 'Initial Node', 
				'final': 'Final Node', 
				'fork': 'Fork Node', 
				'join': 'Join Node', 
				'decision': 'Decision Node', 
				'process': 'Sub-process', 
				/* i18n for widget */
				'sl': 'Line link', 
				'b2t': 'Right-Angle link（Bottom to Top）', 
				'l2r': 'Right-Angle link（Left to Right）', 
				'solid': 'Line', 
				'dashed': 'Dashed', 
				'remove': 'Remove', 
				/* i18n for propertygrid */
				propertygrid: {
					'title': 'Title', 
					'remarks': 'Remarks', 
					'creator': 'Creator', 
					'created': 'Created', 
					'modifier': 'Modifier', 
					'modified': 'Modified', 
					'version': 'Version', 
					'text': 'Text label', 
					'shape': 'Graphics shape', 
					'id': 'Unique identifier', 
					'left': 'Offset of left', 
					'top': 'Offset of top', 
					'kind': 'Kind of shape', 
					'color': 'Background color', 
					'width': 'Width', 
					'height': 'Height', 
					'alt': 'Update flag', 
					'tips': 'No properties to display at this time', 
					'style': 'Line style', 
					'marked': 'Highlight', 
					'dashed': 'Dashed', 
					'from': 'From node', 
					'to': 'To node', 
					'mid': 'Line center point',
					'precondition': 'Precondition',
					'type': 'Task Type',
					'language': 'Script Language',
					'script': 'Script Source',
					'series': 'Series（e.g. human actor organization）',
					'respond': 'Respond mode',
					'actors': 'Actors',
					'fallback': 'Fallback',
					'circulative': 'Circulative',
					'countersign': 'Countersign',
					'transferable': 'Transferable',
					'suspendable': 'Suspendable',
					'terminable': 'Terminable'
				},
				/* i18n for errors */
				'loading.message': 'Loading - Please wait...', 
				'invalid.link': 'Invalid link', 
				'invalid.data': 'Invalid data', 
				'invalid.repository': 'No remote repository specified, Please specify either a valid URL.', 
				'duplicate.data': 'Duplicate data', 
				'not.match': 'No matches found',
				'repeating.link': 'Repeating link',
				'image.export': 'Failed to export image',
				'load.error': 'Failed to load data from remote service'
			}
		},
		/*颜色*/
		cssStyle: { borderColor: '#00B4E1', nodeColor: '#A1DCEB', lineColor: '#3892D3', highlightColor: '#ff3300', processColor: '#B6F700', fontColor: '#333333' },
		/*色块*/
		colorMap: { red: 'green', green: 'blue', blue: 'black', black: 'white', white: 'yellow', yellow: 'orange', orange: 'gray', gray: 'red' },
		/*事件色块*/
		eventColorMap: { '82': 'random', '49': 'default', '50': 'red', '51': 'green', '52': 'blue', '53': 'black', '54': 'white', '55': 'yellow', '56': 'orange', '57': 'gray' },
		/*形状*/
		shapeSet: { round: '圆形', square: '正方形', rect: '矩形', roundRect: '圆角矩形', rhombus: '菱形' },
		/*数据*/
		data: { lineSet: {}, nodeSet: {}, title: 'New Workflow', remarks: '', creator: 'Anonymous', created: Graphics.Api.now(), modifier: '', modified: '', version: Graphics.Api.timestamp() },
		/*数据储存库*/
		dataRepository: null,
		/*数据缓冲区*/
		buffer: { recyclebin: {}, stack: { _e: [], push: new Function('return this._e.push.apply(this._e, arguments)'), pop: new Function('return this._e.pop()') }, undo: [], redo: [] },
		/*序号*/
		serialNumber: 1,
		/*活动节点*/
		activeNode: null,
		/*活动按扭*/
		activeButton: 'cursor',
		/*画布光标*/
		canvas: {
			cursor: 'default',
			dragScrollable: false,
			editable: true
		},
		propertyGrid: {
			width: 224,
			cursor: 'default',
			editable: true,
			visible: true
		},
		onRestyle: function(params){
			return true;
		},
		onRelink: function(params){
			return true;
		},
		onRename: function(params){
			return true;
		},
		onBlur: function(params){
			return true;
		},
		onFocus: function(params){
			return true;
		},
		onMove: function(params){
			return true;
		},
		onResize: function(params){
			return true;
		},
		onAppend: function(params){
			return true;
		},
		onRemove: function(params){
			return true;
		},
		onMenuItemClick: function(item){
		},
		onButtonItemClick: function(kind){
		}
	};
})(jQuery);