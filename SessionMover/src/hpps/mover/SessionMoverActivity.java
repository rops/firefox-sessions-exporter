package hpps.mover;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.channels.FileChannel;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

public class SessionMoverActivity extends Activity {
    /** Called when the activity is first created. */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
//        setContentView(R.layout.main);
        Log.i("hpps-mover","Mover Loaded");
        moveTaskToBack (true);
    }
    @Override
    public void onResume (){
    	super.onResume();
    	moveTaskToBack (true);
    	try{
        	if(getIntent().getData() != null){
		        String tempPath = getIntent().getData().getEncodedPath();
		        File tempFile = new File(tempPath);
		        File newFile = new File("/mnt/sdcard/sessions/session.session");
		        copyFile(tempFile,newFile);
		        Log.i("hpps-mover","File Moved");
		        openBrowser();
        	}else{
        		Log.i("hpps-mover","no input specified");
        	}
        }catch(Exception e){e.printStackTrace();}
    }
	public void openBrowser() {
		
		String url = "chrome://sessionmanager/content/restore.html";
		Intent intent = new Intent(Intent.ACTION_MAIN, null);
		intent.addCategory(Intent.CATEGORY_LAUNCHER);
		intent.setComponent(new ComponentName("org.mozilla.firefox_beta", "org.mozilla.firefox_beta.App"));
		intent.setAction("org.mozilla.gecko.BOOKMARK");
		intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
		intent.putExtra("args", "--url=" + url);
		intent.setData(Uri.parse(url));
		startActivity(intent);
		
	}
    
    public static void copyFile(File sourceFile, File destFile) throws IOException {
        if(!destFile.exists()) {
            destFile.createNewFile();
        }

        FileChannel source = null;
        FileChannel destination = null;
        try {
            source = new FileInputStream(sourceFile).getChannel();
            destination = new FileOutputStream(destFile).getChannel();

            // previous code: destination.transferFrom(source, 0, source.size());
            // to avoid infinite loops, should be:
            long count = 0;
            long size = source.size();              
            while((count += destination.transferFrom(source, count, size-count))<size);
        }
        finally {
            if(source != null) {
                source.close();
            }
            if(destination != null) {
                destination.close();
            }
        }
    }

}