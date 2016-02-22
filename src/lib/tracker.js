'use strict';

window._gaq = window._gaq || [];
window._gaq.push(['_setAccount', 'UA-4523560-11']);
// loadTracker();

export default function(category, action, label) {
	// window._gaq.push(['_trackEvent', category, action, label]);
}

function loadTracker() {
	var ga = document.createElement('script');
	ga.async = true;
	ga.src = 'https://ssl.google-analytics.com/ga.js';
	var s = document.getElementsByTagName('script')[0];
	s.parentNode.insertBefore(ga, s);
}
