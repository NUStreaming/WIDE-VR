(function(d, b, w){
	var hiddenCN = 'hidden';
	var $quicSupport = d.querySelector('.quic-support');
	var $quicLogo = $quicSupport.querySelector('.quic-support__logo');
	var $quicSvg = $quicLogo.querySelector('.quic-support__logo__svg');
	var $quicChecking = $quicSupport.querySelector('.quic-support__text_checking');
	var $quicSuccess = $quicSupport.querySelector('.quic-support__text_success');
	var $quicFail = $quicSupport.querySelector('.quic-support__text_fail');

	var xhr = new XMLHttpRequest();

	xhr.onload = function(){
		if (xhr.status == 200) {
			$quicLogo.classList.remove('quic-support__logo_checking');
			$quicChecking.classList.add(hiddenCN);

			if (xhr.getResponseHeader("X-QUIC") === 'h3') {
				$quicSvg.classList.remove('quic-support__logo__svg_unsupported');
				$quicSuccess.classList.remove(hiddenCN);
			} else {
				$quicFail.classList.remove(hiddenCN);
			}
		} else {
			$quicFail.classList.remove(hiddenCN);
		}
	}

	xhr.onerror = function(e){
		console.log(e);

		$quicFail.classList.remove(hiddenCN);
	}

	w.setTimeout(function(){
		xhr.open("GET", '/test', true);
		xhr.setRequestHeader('Cache-Control', 'no-cache');

		xhr.send(null);
	}, 3000);
})(document, document.body, window);
