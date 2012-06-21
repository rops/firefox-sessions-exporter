package hpps.connectiondown;

import java.util.Calendar;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;

public class DemoActivity extends Activity {
	
	private int interval = 60;
	boolean scheduler = false;
	
    /** Called when the activity is first created. */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        moveTaskToBack (true);
        //setContentView(R.layout.main);
        if(scheduler){
        	schedule();
        }
              
    }
    @Override
    public void onResume (){
    	super.onResume();
    	moveTaskToBack (true);
    	if(!scheduler){
        	AlarmReceiver a = new AlarmReceiver();
        	a.turnOffWifi(this);
        	Log.i("demo-hpps","connection down");
        	try{
        		Thread.sleep(7000);
        	}catch(Exception e ){}
        	a.turnOnWifi(this);
        	Log.i("demo-hpps","connection up");
        }
    }
    
    public void schedule(){
    	// get a Calendar object with current time
        Calendar cal = Calendar.getInstance();
        // add 5 minutes to the calendar object
        cal.add(Calendar.SECOND, interval);
        Intent intent = new Intent(this, AlarmReceiver.class);
        // In reality, you would want to have a static variable for the request code instead of 192837
        PendingIntent sender = PendingIntent.getBroadcast(this, 192837, intent, PendingIntent.FLAG_UPDATE_CURRENT);
        // Get the AlarmManager service
        AlarmManager am = (AlarmManager) getSystemService(ALARM_SERVICE);
        am.setRepeating(AlarmManager.RTC_WAKEUP, cal.getTimeInMillis(), (interval * 1000), sender);
        
        Log.i("demo-hpps","scheduled alarm");
    }
}