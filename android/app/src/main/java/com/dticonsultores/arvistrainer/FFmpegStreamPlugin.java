package com.dticonsultores.arvistrainer;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.ReturnCode;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginMethod;
import android.util.Log;

import java.io.File;

@CapacitorPlugin(name = "FFmpegStream")
public class FFmpegStreamPlugin extends Plugin{

  @PluginMethod
  public void startStream(PluginCall call) {
    String rtspUrl = call.getString("rtspUrl");
    File cacheDir = getContext().getCacheDir();
    String relativePath = "live/stream.jpg";
    File outputfile = new File(cacheDir, relativePath);
    String outputFilePath = outputfile.getAbsolutePath();

    if (rtspUrl == null ) {
      call.reject("La URL RTSP es necesaria.");
      return;
    }

    stopStream(null);

    // Comando FFmpeg para convertir RTSP a HLS (HTTP Live Streaming)
    String ffmpegCommand = "-y -re -rtsp_transport tcp -i " + rtspUrl +
                            " -max_delay 4000000 -analyzeduration 10000000" +
                            " -s 1024x768" +
                            " -vf \"blackdetect,blackframe=amount=98:threshold=32,fps=25\" "+
                            " -fflags +discardcorrupt -vsync cfr -q:v 2" +
                            " -update 1" +
                            " -b:v 1M -err_detect explode " +
                            outputFilePath;

    Log.d("FFmpegStream", "Inicia sesión");
    FFmpegSession session = FFmpegKit.executeAsync(ffmpegCommand, sessionResult -> {
      if (ReturnCode.isSuccess(sessionResult.getReturnCode())) {
        call.setKeepAlive(true);
        JSObject result = new JSObject();
        Log.d("FFmpegStream", "Entro a JSObject");
        result.put("httpUrl", relativePath);
        call.resolve(result);
      } else {
        call.reject("Error al iniciar transmisión: " + sessionResult.getFailStackTrace());
      }
    });

    setSession(session);
  }

  @PluginMethod
  public void stopStream(PluginCall call){
    if (getSession() != null) {
      getSession().cancel();
      clearSession();
      notifySessionStopped();
    }
    if (call != null){
      call.resolve();
    }
  }

  @PluginMethod
  public void pauseStream(PluginCall call) {
    stopStream(null); // Detener la transmisión
    call.resolve(); // Confirmar la pausa a Angular
  }

  // Métodos auxiliares para gestionar la sesión
  private FFmpegSession currentSession;

  private void setSession(FFmpegSession session) {
    this.currentSession = session;
  }

  private FFmpegSession getSession() {
    return this.currentSession;
  }

  private void clearSession() {
    this.currentSession = null;
  }

  // Método para notificar que la sesión fue detenida
  private void notifySessionStopped() {
    JSObject result = new JSObject();
    result.put("message", "Stream detenido");
    notifyListeners("streamStopped", result);
  }
}
