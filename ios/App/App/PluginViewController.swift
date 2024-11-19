//
//  PluginViewController.swift
//  App
//
//  Created by Abel Bueno on 14/11/24.
//

import UIKit
import Capacitor

class PluginViewController: CAPBridgeViewController {
    
    override func viewDidLoad() {
        super.viewDidLoad()
    }
    
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(FFmpegStreamPlugin())
    }
    
    /*
    // MARK: - Navigation

    // In a storyboard-based application, you will often want to do a little preparation before navigation
    override func prepare(for segue: UIStoryboardSegue, sender: Any?) {
        // Get the new view controller using segue.destination.
        // Pass the selected object to the new view controller.
    }
    */

}
