function extend(obj) {
	for (var i = 1, il = arguments.length, source; i < il; i++) {
		source = arguments[i];
		if (source) {
			for (var prop in source) {
				obj[prop] = source[prop];
			}
		}
	}

	return obj;
}

var dummyFn = function() {};
var anims = [];
var idCounter = 0;

var defaults = {
	duration: 500, // ms
	delay: 0,
	easing: 'linear',
	start: dummyFn,
	step: dummyFn,
	complete: dummyFn,
	autostart: true,
	reverse: false
};

export default function(options) {
	return new Tween(options);
}

/**
 * Get or set default value
 * @param  {String} name
 * @param  {Object} value
 * @return {Object}
 */
export function defaults(name, value) {
	if (typeof value != 'undefined') {
		defaults[name] = value;
	}

	return defaults[name];
}

/**
 * Returns all active animation objects.
 * For debugging mostly
 * @return {Array}
 */
export function _all() {
	return anims;
}

export function stop() {
	anims.forEach(anim => anim.stop());
	anims.length = 0;
}

export var easings = {
	linear(t, b, c, d) {
		return c * t / d + b;
	},
	inQuad(t, b, c, d) {
		return c*(t/=d)*t + b;
	},
	outQuad(t, b, c, d) {
		return -c *(t/=d)*(t-2) + b;
	},
	inOutQuad(t, b, c, d) {
		if((t/=d/2) < 1) return c/2*t*t + b;
		return -c/2 *((--t)*(t-2) - 1) + b;
	},
	inCubic(t, b, c, d) {
		return c*(t/=d)*t*t + b;
	},
	outCubic(t, b, c, d) {
		return c*((t=t/d-1)*t*t + 1) + b;
	},
	inOutCubic(t, b, c, d) {
		if((t/=d/2) < 1) return c/2*t*t*t + b;
		return c/2*((t-=2)*t*t + 2) + b;
	},
	inExpo(t, b, c, d) {
		return(t==0) ? b : c * Math.pow(2, 10 *(t/d - 1)) + b - c * 0.001;
	},
	outExpo(t, b, c, d) {
		return(t==d) ? b+c : c * 1.001 *(-Math.pow(2, -10 * t/d) + 1) + b;
	},
	inOutExpo(t, b, c, d) {
		if(t==0) return b;
		if(t==d) return b+c;
		if((t/=d/2) < 1) return c/2 * Math.pow(2, 10 *(t - 1)) + b - c * 0.0005;
		return c/2 * 1.0005 *(-Math.pow(2, -10 * --t) + 2) + b;
	},
	inElastic(t, b, c, d, a, p) {
		var s;
		if(t==0) return b;  if((t/=d)==1) return b+c;  if(!p) p=d*.3;
		if(!a || a < Math.abs(c)) { a=c; s=p/4; } else s = p/(2*Math.PI) * Math.asin(c/a);
		return -(a*Math.pow(2,10*(t-=1)) * Math.sin((t*d-s)*(2*Math.PI)/p )) + b;
	},
	outElastic(t, b, c, d, a, p) {
		var s;
		if(t==0) return b;  if((t/=d)==1) return b+c;  if(!p) p=d*.3;
		if(!a || a < Math.abs(c)) { a=c; s=p/4; } else s = p/(2*Math.PI) * Math.asin(c/a);
		return(a*Math.pow(2,-10*t) * Math.sin((t*d-s)*(2*Math.PI)/p ) + c + b);
	},
	inOutElastic(t, b, c, d, a, p) {
		var s;
		if(t==0) return b; 
		if((t/=d/2)==2) return b+c;
		if(!p) p=d*(.3*1.5);
		if(!a || a < Math.abs(c)) { a=c; s=p/4; }       else s = p/(2*Math.PI) * Math.asin(c/a);
		if(t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin((t*d-s)*(2*Math.PI)/p )) + b;
		return a*Math.pow(2,-10*(t-=1)) * Math.sin((t*d-s)*(2*Math.PI)/p )*.5 + c + b;
	},
	inBack(t, b, c, d, s) {
		if(s == undefined) s = 1.70158;
		return c*(t/=d)*t*((s+1)*t - s) + b;
	},
	outBack(t, b, c, d, s) {
		if(s == undefined) s = 1.70158;
		return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
	},
	inOutBack(t, b, c, d, s) {
		if(s == undefined) s = 1.70158;
		if((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;
		return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;
	},
	inBounce(t, b, c, d) {
		return c - this.outBounce(t, d-t, 0, c, d) + b;
	},
	outBounce(t, b, c, d) {
		if((t/=d) <(1/2.75)) {
			return c*(7.5625*t*t) + b;
		} else if(t <(2/2.75)) {
			return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
		} else if(t <(2.5/2.75)) {
			return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
		} else {
			return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
		}
	},
	inOutBounce(t, b, c, d) {
		if(t < d/2) return this.inBounce(t*2, 0, c, d) * .5 + b;
		return this.outBounce(t*2-d, 0, c, d) * .5 + c*.5 + b;
	},
	outHard(t, b, c, d) {
		var ts = (t/=d)*t;
		var tc = ts*t;
		return b + c*(1.75*tc*ts + -7.4475*ts*ts + 12.995*tc + -11.595*ts + 5.2975*t);
	}
};

export class Tween {
	constructor(options) {
		this.options = extend({}, defaults, options);
		
		var e = this.options.easing;
		if (typeof e == 'string') {
			if (!easings[e]) {
				throw new Error('Unknown "' + e + '" easing function');
			}
			this.options.easing = easings[e];
		}
		
		if (typeof this.options.easing !== 'function') {
			throw 'Easing should be a function';
		}

		this._id = 'tw' + (idCounter++);
		
		if (this.options.autostart) {
			this.start();
		}
	}

	/**
	 * Start animation from the beginning
	 */
	start() {
		if (!this.animating) {
			this.pos = 0;
			this.startTime = Date.now() + (this.options.delay || 0);
			this.infinite = this.options.duration === 'infinite';
			this.endTime = this.infinite ? 0 : this.startTime + this.options.duration;
			this.animating = true;
			this.options.start(this);
			addToQueue(this);
		}

		return this;
	}
	
	/**
	 * Stop animation
	 */
	stop() {
		if (this.animating) {
			this.animating = false;
			if (this.options.complete) {
				this.options.complete(this);
			}
		}
		return this;
	}

	toggle() {
		if (this.animating) {
			this.stop();
		} else {
			this.start();
		}
	}
}

function mainLoop() {
	if (!anims.length) {
		// no animations left, stop polling
		return;
	}
	
	var now = Date.now();
	var filtered = [], tween, opt;

	// do not use Array.filter() of _.filter() function
	// since tween’s callbacks can add new animations
	// in runtime. In this case, filter function will loose
	// newly created animation
	for (var i = 0; i < anims.length; i++) {
		tween = anims[i];

		if (!tween.animating) {
			continue;
		}

		opt = tween.options;

		if (tween.startTime > now) {
			filtered.push(tween);
			continue;
		}

		if (tween.infinite) {
			// opt.step.call(tween, 0);
			opt.step(0, tween);
			filtered.push(tween);
		} else if (tween.pos === 1 || tween.endTime <= now) {
			tween.pos = 1;
			// opt.step.call(tween, opt.reverse ? 0 : 1);
			opt.step(opt.reverse ? 0 : 1, tween);
			tween.stop();
		} else {
			tween.pos = opt.easing(now - tween.startTime, 0, 1, opt.duration);
			// opt.step.call(tween, opt.reverse ? 1 - tween.pos : tween.pos);
			opt.step(opt.reverse ? 1 - tween.pos : tween.pos, tween);
			filtered.push(tween);
		}			
	}

	anims = filtered;

	if (anims.length) {
		requestAnimationFrame(mainLoop);
	}
}

function addToQueue(tween) {
	if (anims.indexOf(tween) === -1) {
		anims.push(tween);
		if (anims.length === 1) {
			mainLoop();
		}
	}
}