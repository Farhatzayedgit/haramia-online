package com.movera.haramiya;

import android.os.Bundle;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // الشاشة متطفيش وإنتوا بتلعبوا
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // زرار الرجوع يخبّي الأبليكيشن بدل ما يقفله، عشان اللعبة متضيعش
        moveTaskToBack(true);
    }
}
