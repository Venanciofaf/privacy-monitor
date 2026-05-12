// ============================================================
// PRIVACY MONITOR — Injected Script (roda dentro da página)
// ============================================================

(function() {

  function notificar(api) {
    window.postMessage({ __privacyMonitor: true, api }, "*");
  }

  // Canvas API
  const _toDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function(...args) {
    notificar("Canvas.toDataURL");
    return _toDataURL.apply(this, args);
  };

  const _getImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function(...args) {
    notificar("Canvas.getImageData");
    return _getImageData.apply(this, args);
  };

  // WebGL
  const _getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(...args) {
    notificar("WebGL.getParameter");
    return _getParameter.apply(this, args);
  };

  const _getExtension = WebGLRenderingContext.prototype.getExtension;
  WebGLRenderingContext.prototype.getExtension = function(...args) {
    const ext = _getExtension.apply(this, args);
    if (args[0] === "WEBGL_debug_renderer_info") {
      notificar("WebGL.WEBGL_debug_renderer_info");
    }
    return ext;
  };

  // AudioContext
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (AudioCtx) {
    const _createOscillator = AudioCtx.prototype.createOscillator;
    AudioCtx.prototype.createOscillator = function(...args) {
      notificar("AudioContext.createOscillator");
      return _createOscillator.apply(this, args);
    };

    const _createDynamicsCompressor = AudioCtx.prototype.createDynamicsCompressor;
    AudioCtx.prototype.createDynamicsCompressor = function(...args) {
      notificar("AudioContext.createDynamicsCompressor");
      return _createDynamicsCompressor.apply(this, args);
    };
  }

})();