//
//  FFmpegStreamPlugin.swift
//  App
//
//  Created by Abel Bueno on 15/11/24.
//

import Foundation
import Capacitor
import ffmpegkit

@objc(FFmpegStream)
public class FFmpegStreamPlugin: CAPPlugin{

    private var currentSession: FFmpegSession?

    @objc func startStream(_ call: CAPPluginCall){
        guard let rtspUrl = call.getString("rtspUrl") else {
            call.reject("La URL RTSP es necesaria.")
            return
        }

        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let outputfile = cacheDir.appendingPathComponent("live/stream.jpg")
        let outputfilePath = outputfile.path

        stopStream(nil)

        let ffmpegCommand = "-y -re -rtsp_transport tcp -i \(rtspUrl) -vf scale=640:480,fps=30 -compression_level 2 -fflags +discardcorrupt -vsync cfr -q:v 15 -update 1 -b:v 500k -err_detect explode \(outputfilePath)"

        self.currentSession = FFmpegKit.executeAsync(ffmpegCommand) { session in
            if session?.getReturnCode()?.isValueSuccess() == true {
                call.keepAlive = true
                let result = [
                    "httpUrl": outputfile.relativePath
                ]
                call.resolve(result)
            }else{
                call.reject("Error al iniciar transmisión: \(session?.getFailStackTrace() ?? "unknown error")")
            }
        }
    }

    @objc func stopStream(_ call: CAPPluginCall?){
      print("Entro a plugin call")
      if let session = currentSession {
        session.cancel()
        clearSession()
        notifySessionStopped()
      }

      if let call = call {
        call.resolve()
      }
    }

    @objc func pauseStream(_ call: CAPPluginCall){
      stopStream(nil)
      call.resolve()
    }

    private func clearSession(){
      self.currentSession = nil
    }

    private func notifySessionStopped(){
      var result = JSObject()
      result["message"] = "Stream detenido"
      notifyListeners("streamStopped", data: result)
    }
}
