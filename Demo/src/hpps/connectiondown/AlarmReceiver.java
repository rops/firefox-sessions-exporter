package hpps.connectiondown;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.wifi.WifiManager;
import android.util.Log;

public class AlarmReceiver extends BroadcastReceiver {

	@Override
	public void onReceive(Context arg0, Intent arg1) {
		 Log.i("demo-hpps","alarm fired");
		 turnOffWifi(arg0);
		 Log.i("demo-hpps","wifi off");
		 try {
			Thread.sleep(5000);
		} catch (InterruptedException e) {
			Log.i("demo-hpps","cant sleep");
		}
		 turnOnWifi(arg0);
		 Log.i("demo-hpps","wifi on");
	}
	
	public void turnOffWifi(Context ctx){
		WifiManager wifiManager = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE);
		wifiManager.setWifiEnabled(false);
	}
	public void turnOnWifi(Context ctx){
		WifiManager wifiManager = (WifiManager) ctx.getSystemService(Context.WIFI_SERVICE);
		wifiManager.setWifiEnabled(true);
	}
	
}
