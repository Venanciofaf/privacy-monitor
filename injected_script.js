(function() {
  function notificar(api) {
    window.postMessage({ __privacyMonitor: true, api: api }, "*");
  }

  // ====== Canvas ======
  const _toDataURL = HTMLCanvasElement.prototype.toDataURL;
  HTMLCanvasElement.prototype.toDataURL = function() {
    notificar("Canvas.toDataURL");
    return _toDataURL.apply(this, arguments);
  };

  const _getImageData = CanvasRenderingContext2D.prototype.getImageData;
  CanvasRenderingContext2D.prototype.getImageData = function() {
    notificar("Canvas.getImageData");
    return _getImageData.apply(this, arguments);
  };

  // ====== WebGL ======
  // Constantes de UNMASKED são 0x9245 e 0x9246
  const UNMASKED_VENDOR = 0x9245;
  const UNMASKED_RENDERER = 0x9246;

  const _getParameter = WebGLRenderingContext.prototype.getParameter;
  WebGLRenderingContext.prototype.getParameter = function(param) {
    notificar("WebGL.getParameter");
    if (param === UNMASKED_VENDOR) {
      notificar("WebGL.UNMASKED_VENDOR_WEBGL");
    }
    if (param === UNMASKED_RENDERER) {
      notificar("WebGL.UNMASKED_RENDERER_WEBGL");
    }
    return _getParameter.apply(this, arguments);
  };

  const _getExtension = WebGLRenderingContext.prototype.getExtension;
  WebGLRenderingContext.prototype.getExtension = function() {
    const ext = _getExtension.apply(this, arguments);
    if (arguments[0] === "WEBGL_debug_renderer_info") {
      notificar("WebGL.WEBGL_debug_renderer_info");
    }
    return ext;
  };

  // ====== WebGL2 (mesma proteção do WebGL1) ======
  if (window.WebGL2RenderingContext) {
    const _getParameter2 = WebGL2RenderingContext.prototype.getParameter;
    WebGL2RenderingContext.prototype.getParameter = function(param) {
      notificar("WebGL.getParameter");
      if (param === UNMASKED_VENDOR) notificar("WebGL.UNMASKED_VENDOR_WEBGL");
      if (param === UNMASKED_RENDERER) notificar("WebGL.UNMASKED_RENDERER_WEBGL");
      return _getParameter2.apply(this, arguments);
    };

    const _getExtension2 = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function() {
      const ext = _getExtension2.apply(this, arguments);
      if (arguments[0] === "WEBGL_debug_renderer_info") {
        notificar("WebGL.WEBGL_debug_renderer_info");
      }
      return ext;
    };
  }

  // ====== AudioContext ======
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (AudioCtx) {
    const _createOscillator = AudioCtx.prototype.createOscillator;
    AudioCtx.prototype.createOscillator = function() {
      notificar("AudioContext.createOscillator");
      return _createOscillator.apply(this, arguments);
    };

    const _createDynamicsCompressor = AudioCtx.prototype.createDynamicsCompressor;
    AudioCtx.prototype.createDynamicsCompressor = function() {
      notificar("AudioContext.createDynamicsCompressor");
      return _createDynamicsCompressor.apply(this, arguments);
    };
  }

  // ====== WebGPU (novo em 2026) ======
  if (navigator.gpu && navigator.gpu.requestAdapter) {
    const _requestAdapter = navigator.gpu.requestAdapter;
    navigator.gpu.requestAdapter = function() {
      notificar("WebGPU.requestAdapter");
      return _requestAdapter.apply(this, arguments);
    };
  }
})();