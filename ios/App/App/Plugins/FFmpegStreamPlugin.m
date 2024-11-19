//
//  FFmpegStreamPlugin.m
//  App
//
//  Created by Abel Bueno on 15/11/24.
//

#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(FFmpegStream, "FFmpegStream",
           CAP_PLUGIN_METHOD(startStream, CAPPluginReturnPromise);
)
