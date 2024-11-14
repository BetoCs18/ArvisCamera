package com.dticonsultores.arvistrainer;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.ReturnCode;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import com.getcapacitor.PluginMethod;

import java.io.File;

@CapacitorPlugin(name = "FFmpegStream")
public class FFmpegStreamPlugin extends Plugin{

  @PluginMethod
  public void startStream(PluginCall call) {
    String rtspUrl = call.getString("rtspUrl");
    //String outputHttpUrl = "http://localhost:8080/live/stream.m3u8"; // URL de salida HTTP;
    File cacheDir = getContext().getCacheDir();
    String relativePath = "live/stream.jpg";
    File outputfile = new File(cacheDir, relativePath);
    String outputFilePath = outputfile.getAbsolutePath();

    //String outputPath = "/storage/emulated/0/Download/live/";
    //String outputFile = outputPath + "stream.jpg";

    if (rtspUrl == null ) {
      call.reject("La URL RTSP es necesaria.");
      return;
    }

    /*File outputDir = new File(outputPath);
    if (!outputDir.exists()) {
      outputDir.mkdirs();
    }*/

    // Comando FFmpeg para convertir RTSP a HLS (HTTP Live Streaming)
    //String ffmpegCommand = "-i " + rtspUrl + " -f hls -hls_time 2 -hls_list_size 5 -hls_flags delete_segments " + outputHttpUrl;
    //String ffmpegCommand = "-i " + rtspUrl + " -c:v libx264 -preset ultrafast -f hls -hls_time 2 -hls_list_size 5 -hls_flags delete_segments " + outputHttpUrl;
    String ffmpegCommand = "-y -i " + rtspUrl +
                            " -s 1024x768" +
                            " -vf fps=20" +
                            " -update 1" +
                            " -q:v 2" +
                            " " + outputFilePath;

    // Ejecuta el comando FFmpeg de forma asíncrona
    FFmpegKit.executeAsync(ffmpegCommand, session -> {
      if (ReturnCode.isSuccess(session.getReturnCode())) {
        JSObject result = new JSObject();
        result.put("httpUrl", relativePath);
        call.resolve(result);
      } else {
        call.reject("Error al iniciar transmisión: " + session.getFailStackTrace());
      }
    });
  }
}
