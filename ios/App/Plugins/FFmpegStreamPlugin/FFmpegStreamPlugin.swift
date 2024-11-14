//
//  File.swift
//  App
//
//  Created by Abel Bueno on 14/11/24.
//

import Foundation
import Capacitor
import ffmpegkit

@objc(FFmpegStream)
public class FFmpegStreamPlugin: CAPPlugin{
    
    @objc func startStream(_ call: CAPPluginCall){
        guard let rtspUrl = call.getString("rtspUrl") else {
            call.reject("La URL RTSP es necesaria.")
            return
        }
        
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        let outputfile = cacheDir.appendingPathComponent("live/stream.jpg")
        let outputfilePath = outputfile.path
        
        let ffmpegCommand = "-y -i \(rtspUrl) -s 1024x768 -vf fps=20 -update 1 -q:v 2 \(outputfilePath)"
        
        FFmpegKit.executeAsync(ffmpegCommand) { session in
            if session?.getReturnCode()?.isValueSuccess() == true {
                let result = [
                    "httpUrl": outputfile.relativePath
                ]
                call.resolve(result)
            }else{
                call.reject("Error al iniciar transmisión: \(session?.getFailStackTrace() ?? "unknown error")")
            }
        }
    }
}
