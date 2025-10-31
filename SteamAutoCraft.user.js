// ==UserScript==
// @name         Steam-Autocraft
// @version      1.4
// @description  AutoCraft Steam Community Badges
// @author       nidushan
// @include      /^https?:\/\/steamcommunity\.com\/+(id\/+[A-Za-z0-9$-_.+!*'(),]+|profiles\/+[0-9]+)\/+(badges\/?|gamecards\/+[0-9]+\/?).*$/
// @require      https://ajax.googleapis.com/ajax/libs/jquery/1.11.1/jquery.min.js
// @copyright    2025 nidushan
// @grant        none
// ==/UserScript==

// Vars
var badgesPageURL            = '/badges/';
var badgeCraftLimit          = '';
var canCraftBadge            = 0;
var craftRefreshTimeoutmsDef = 2000;
var craftRefreshTimeoutms    = craftRefreshTimeoutmsDef;
var gamecardHref             = '';
var gamecardHrefLinks        = '';
var gameIdBlackList          = '';
var isBadgesPage             = 0;
var isGameCardsPage          = 0;
var pageRefreshTimeoutmsDef  = 10000;
var pageRefreshTimeoutms     = pageRefreshTimeoutmsDef;
var redirect                 = 0;
var skipCraft                = 0;
var steamAutoCraftVersion    = '1.4';

// guard to avoid double-adding UI
var _uiInserted = false;

jQuery(document).ready(function(){
    // Re-query dynamic nodes AFTER load (Steam injects late)
    var badgeLinks         = jQuery('.badge_details_set_favorite');
    var badgeProgressTasks = jQuery('.badge_progress_tasks');
    var invLinks           = jQuery('.gamecards_inventorylink');
    var badgeProgress      = jQuery('.gamecard_badge_progress');

    // Check settings
    checkSettings();

    // Determine current page
    if (invLinks.length >= 1) {
        isGameCardsPage  = 1;
    } else if ((badgeLinks.length >= 1) && (invLinks.length <= 0)) {
        isBadgesPage     = 1;
    }

    // Check for badges to craft
    if (jQuery('.badge_craft_button').length >= 1){
        if ((badgeProgressTasks.length >= 1) || (badgeProgress.length >= 1)){
            canCraftBadge  = 1;
        }
    }

    // Badge page logic
    if (isBadgesPage === 1) {
        window.sessionStorage.badgesPageURL = window.location.href;
        if (window.sessionStorage.craftRecursive) {
            if (canCraftBadge === 0) {
                delete window.sessionStorage.craftRecursive;
            }
        }
    }

    // Gamecard page logic
    if (isGameCardsPage === 1) {
        if ((canCraftBadge === 0) && (window.sessionStorage.craftRecursive)) {
            delete window.sessionStorage.autoCraftState;

            if(window.localStorage.badgeCraftLimit) {
               if(!window.sessionStorage.craftCount) { window.sessionStorage.craftCount = 0; }
               window.sessionStorage.craftCount = +window.sessionStorage.craftCount + 1;
            }

            if(window.sessionStorage.badgesPageURL) {
                badgesPageURL = window.sessionStorage.badgesPageURL;
            }
            delete window.sessionStorage.badgesPageURL;

            // If all badges have been crafted, load badges page
            window.location.href = badgesPageURL;
        }
    }

    // Detect conflict with userscript
    if (jQuery('#autocraft').length >= 1) {
        var steamAutoCraftConflictError = 'Conflict detected, please remove or disable either the Steam-AutoCraft extension or the userscript.';
        alert(steamAutoCraftConflictError);
        throw new Error(steamAutoCraftConflictError);
    }

    // Check blacklist and add button
    jQuery.when(checkBlacklist()).done( function() {
        addButton();
    });

    // Disable reset button when applicable
    if ((+pageRefreshTimeoutms === pageRefreshTimeoutmsDef) &&
        (+craftRefreshTimeoutms === craftRefreshTimeoutmsDef) && (!gameIdBlackList)) {
        jQuery('#autocraft_button_reset').addClass('btn_disabled');
        jQuery('#autocraft_button_reset').prop('disabled',true);
    } else {
        jQuery('#autocraft_button_reset').removeClass('btn_disabled');
    }

    // Start autoCraft
    if ((canCraftBadge === 1) && ((window.sessionStorage.autoCraftState) || (window.sessionStorage.craftRecursive))) {

        if ((window.localStorage.badgeCraftLimit) && (window.sessionStorage.craftCount)) {
           if (+window.sessionStorage.craftCount >= +window.localStorage.badgeCraftLimit) {
              delete window.sessionStorage.craftRecursive;
              delete window.sessionStorage.craftCount;
              redirect  = 0;
              skipCraft = 1;
           }
        }

        if (redirect === 1 && gamecardHref) {
            window.location.href = gamecardHref;
        }
        jQuery.when(checkBlacklist()).done( function() {
            if (skipCraft === 0) {
               craftBadge();
            }
        });
    }

    // Light watcher: if Steam injects craft buttons a bit later, enable the UI
    var mo = new MutationObserver(function(){
        // enable AutoCraft if craft button appears later
        if (jQuery('.badge_craft_button').length && jQuery('#autocraft').hasClass('btn_disabled')) {
            jQuery('#autocraft').removeClass('btn_disabled').prop('disabled', false);
        }
        // avoid re-inserting UI
        if (!_uiInserted) {
            if ((isBadgesPage && jQuery('.badge_details_set_favorite').length) ||
                (isGameCardsPage && jQuery('.gamecards_inventorylink').length)) {
                addButton();
            }
        }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });
});

function addButton() {
    if (_uiInserted) return; // prevent duplicate UI
    _uiInserted = true;

    // --- Settings modal styling (once) ---
if (!document.getElementById('autocraft_settings_css')) {
  const css = `
   #autocraft_settings_div{width:720px;max-width:92vw;}
   #autocraft_settings_div .newmodal_header{padding:14px 18px}
   #autocraft_settings_title{font-size:22px;font-weight:700;color:#dfe3e6}
   #autocraft_settings_close{float:right;cursor:pointer}

   #autocraft_settings_list{padding:0}
   #autocraft_settings_div .setting-row{
     display:flex;align-items:center;gap:12px;
     padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06)
   }
   #autocraft_settings_div .setting-row:last-child{border-bottom:0}
   #autocraft_settings_div .label{width:260px;min-width:260px;color:#c7d5e0;font-weight:600}
   #autocraft_settings_div .value{min-width:100px}
   #autocraft_settings_div .market_dialog_input{width:90px;padding:6px 8px;text-align:right}
   #autocraft_settings_div .desc{color:#8f98a0}

   #autocraft_settings_div .market_dialog_content_separator{margin:6px 0}
   #autocraft_settings_div .market_dialog_content_dark{padding:14px 16px}
   #autocraft_settings_div .market_sell_dialog_input_area{
     display:flex;gap:8px;justify-content:center
   }
   #autocraft_settings_div .btn_grey_grey.btn_small_thin{min-width:88px}
   #autocraft_settings_div .market_listing_game_name{text-align:center}
  `;
  const st = document.createElement('style');
  st.id = 'autocraft_settings_css';
  st.textContent = css;
  document.head.appendChild(st);
}

    // Set HTML vars
    var settingsDiv = `
<div id="autocraft_settings_div" class="newmodal" style="position: fixed; z-index: 1000; left: 50%; top: 15%; display: none; transform: translateX(-50%);">
  <div class="newmodal_header_border">
    <div class="newmodal_header">
      <span id="autocraft_settings_title">SteamAutoCraft Settings</span>
      <div id="autocraft_settings_close" class="newmodal_close"></div>
    </div>
  </div>
  <div class="newmodal_content_border">
    <div class="newmodal_content">
      <div class="market_dialog_content">
        <div class="market_dialog_iteminfo">
          <div id="autocraft_settings_list" class="market_content_block market_home_listing_table market_home_main_listing_table market_listing_table">
            <form id="autocraft_settings_form" align="left">

              <div class="setting-row">
                <span class="label">Page Refresh Timeout (ms):</span>
                <span class="value">
                  <input type="text" class="market_dialog_input" id="autocraft_setting_refresh_timeout" name="autocraft_setting_refresh_timeout" value="`+pageRefreshTimeoutms+`">
                </span>
                <span class="desc">The longer refresh that happens after crafting each badge (milliseconds).</span>
              </div>

              <div class="setting-row">
                <span class="label">Craft Refresh Timeout (ms):</span>
                <span class="value">
                  <input type="text" class="market_dialog_input" id="autocraft_setting_craft_refresh_timeout" name="autocraft_setting_craft_refresh_timeout" value="`+craftRefreshTimeoutms+`">
                </span>
                <span class="desc">The short refresh set immediately after starting a craft (milliseconds).</span>
              </div>

              <div class="setting-row">
                <span class="label">Game ID Blacklist (id1,id2):</span>
                <span class="value">
                  <input type="text" class="market_dialog_input" id="autocraft_setting_blacklist" name="autocraft_setting_blacklist" value="`+gameIdBlackList+`">
                </span>
                <span class="desc">Comma-separated app IDs, e.g., 12345,67890. These games are skipped.</span>
              </div>

              <div class="setting-row">
                <span class="label">Badge Crafting Limit:</span>
                <span class="value">
                  <input type="text" class="market_dialog_input" id="autocraft_setting_badgelimit" name="autocraft_setting_badgelimit" value="`+badgeCraftLimit+`">
                </span>
                <span class="desc">Number of badges to craft before stopping (leave empty for no limit).</span>
              </div>

              <div class="market_dialog_content_separator"></div>

              <div class="market_dialog_content market_dialog_content_dark">
                <div class="market_sell_dialog_input_area">
                  <input id="autocraft_button_reset" type="button" class="btn_grey_grey btn_small_thin" name="Reset" value="Reset" align="center">
                  <input id="autocraft_button_save" type="button" class="btn_grey_grey btn_small_thin" name="Save" value="Save" align="center">
                </div>
              </div>

            </form>
          </div>
        </div>
      </div>
      <p class="market_listing_game_name">Steam-AutoCraft Version: `+steamAutoCraftVersion+`</p>
    </div>
  </div>
</div>`;


    jQuery('body').append('<div id="autocraft_settings_background_div" class="newmodal_background" style="opacity: 0.8; display: none;"></div>');

    // Load economy.css
    var economyCSS = '/public/css/skin_1/economy.css';
    if(jQuery("link[href*='"+economyCSS+"']").attr('rel') !== 'stylesheet'){
        jQuery('head').append('<link href="'+economyCSS+'" rel="stylesheet" type="text/css">');
    }

    // Load economy_market.css
    var economyMarketCSS = '/public/css/skin_1/economy_market.css';
    if(jQuery("link[href*='"+economyMarketCSS+"']").attr('rel') !== 'stylesheet'){
        jQuery('head').append('<link href="'+economyMarketCSS+'" rel="stylesheet" type="text/css">');
    }

    // Add button to badge details page
    if (isGameCardsPage === 1){
        // Add settings div
        jQuery(settingsDiv).insertAfter('.gamecards_inventorylink');
        jQuery('#autocraft_button_reset').click(function(){ resetSettings(); });
        jQuery('#autocraft_button_save').click(function(){ saveSettings(); });

        // Buttons
        var invLinks = jQuery('.gamecards_inventorylink');
        invLinks.append('\
<a class="btn_grey_grey btn_small_thin btn_disabled" id="autocraft">\
   <span>AutoCraft&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>\
</a>\
<a class="btn_grey_grey btn_small_thin" id="autocraft_settings">\
   <span>&#9881;</span>\
</a>');

        // Set initial position
        var position = jQuery('#autocraft').position();
        var x        = position.left;
        var y        = position.top;
        x           -= (jQuery('#autocraft_settings').outerWidth() - jQuery('#autocraft').outerWidth());
        jQuery('#autocraft_settings').css({
            position: 'absolute',
            zIndex:   500,
            top:      y,
            left:     x
        });

        // (kept) overlay styling attempt; harmless if ignored by browser
        jQuery('#autocraft_settings').css({
            position:            'element(#autocraft)',
            zIndex:              500,
            transform:           'translateX(-100%)',
            'background-color':  'transparent',
            'background-repeat': 'no-repeat',
            border:              'none',
            cursor:              'pointer',
            overflow:            'hidden',
            outline:             'none',
            top:                 '',
            left:                ''
        });

        jQuery('#autocraft_settings').click(function(){ toggleSettings(); });
        jQuery('#autocraft_settings_close').click(function(){ toggleSettings(); });
        // Allow Esc key to close settings
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && jQuery('#autocraft_settings_div').is(':visible')) {
    toggleSettings();
  }
});


        if (canCraftBadge == 1){
            jQuery('#autocraft').click(function(){ autoCraft(); });
            jQuery('#autocraft').removeClass('btn_disabled');
            jQuery('#autocraft').prop('disabled',false);
        }

        return;
    }

    // Add button to badges page
    if (isBadgesPage === 1){
        // Add settings div
        jQuery(settingsDiv).insertAfter('.badge_details_set_favorite');
        jQuery('#autocraft_button_reset').click(function(){ resetSettings(); });
        jQuery('#autocraft_button_save').click(function(){ saveSettings(); });

        // Buttons
        var autoCraftButtonText = 'AutoCraft all badges';

        if (window.localStorage.badgeCraftLimit) {
            if (+window.localStorage.badgeCraftLimit === 1) {
                autoCraftButtonText = 'AutoCraft 1 badge';
            } else {
                autoCraftButtonText = 'AutoCraft '+window.localStorage.badgeCraftLimit+' badges';
            }
        }

        var badgeLinks = jQuery('.badge_details_set_favorite');
        badgeLinks.append('\
<a class="btn_grey_black btn_small_thin btn_disabled" id="autocraft">\
   <span>'+autoCraftButtonText+'&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>\
</a>\
<a class="btn_grey_black btn_small_thin" id="autocraft_settings">\
   <span>&#9881;</span>\
</a>');

        // Set initial position
        var autocraft_position = jQuery('#autocraft').position();
        var autocraft_x        = autocraft_position.left;
        var autocraft_y        = autocraft_position.top;
        autocraft_x           -= (jQuery('#autocraft_settings').outerWidth() - jQuery('#autocraft').outerWidth());
        jQuery('#autocraft_settings').css({
            position: 'absolute',
            zIndex:   500,
            top:      autocraft_y,
            left:     autocraft_x
        });

        // (kept) overlay styling attempt
        jQuery('#autocraft_settings').css({
            position:            'element(#autocraft)',
            zIndex:              500,
            transform:           'translateX(-100%)',
            'background-color':  'transparent',
            'background-repeat': 'no-repeat',
            border:              'none',
            cursor:              'pointer',
            overflow:            'hidden',
            outline:             'none',
            top:                 '',
            left:                ''
        });

        jQuery('#autocraft_settings').click(function(){ toggleSettings(); });
        jQuery('#autocraft_settings_close').click(function(){ toggleSettings(); });
        // Allow Esc key to close settings
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape' && jQuery('#autocraft_settings_div').is(':visible')) {
    toggleSettings();
  }
});


        if (canCraftBadge == 1){
            gamecardHrefLinks = jQuery('div').find('.badge_row .badge_craft_button');
            // FIX: get the href, not the element
            var first = gamecardHrefLinks[0];
            if (first) {
                gamecardHref = jQuery(first).attr('href') || '';
            }
            if (gamecardHref) {
                jQuery('#autocraft').removeClass('btn_disabled');
                jQuery('#autocraft').prop('disabled',false);
                jQuery('#autocraft').click(function(){
                    window.sessionStorage.craftRecursive = 1;
                    window.location.href = gamecardHref;
                });
            } else {
                delete window.sessionStorage.autoCraftState;
            }
        }

        return;
    }
}

// Auto-craft
function autoCraft() {
    craftBadge();
    setTimeout(function(){ window.location.reload(true); }, pageRefreshTimeoutms);
    window.sessionStorage.autoCraftState = 1;
}

// Check settings
function checkSettings() {
    // Use localStorage for persistence across browser sessions
    if (window.localStorage.pageRefreshTimeoutms) {
        pageRefreshTimeoutms = window.localStorage.pageRefreshTimeoutms;
    }

    if (window.localStorage.craftRefreshTimeoutms) {
        craftRefreshTimeoutms = window.localStorage.craftRefreshTimeoutms;
    }

    if (window.localStorage.gameIdBlackList) {
        gameIdBlackList = window.localStorage.gameIdBlackList;
    }

    if (window.localStorage.badgeCraftLimit) {
        badgeCraftLimit = window.localStorage.badgeCraftLimit;
    }
}

// Check blacklist
function checkBlacklist() {
    if (isGameCardsPage === 1) { return jQuery.Deferred().resolve(); }

    // Join csv blacklist with pipe for use inside regex
    var blacklist = (gameIdBlackList || '').replace(/[ \t]*,[ \t]*/g, '|').trim();
    if (!blacklist) {
        // Redirect or clean up when no blacklist
        if (jQuery('.badge_craft_button').length >= 1) {
            redirect = 1;
        } else {
            delete window.sessionStorage.craftRecursive;
            jQuery('#autocraft').addClass('btn_disabled');
            jQuery('#autocraft').prop('disabled',true);
        }
        return jQuery.Deferred().resolve();
    }

    // Escape dangerous regex chars in ids (defensive)
    blacklist = blacklist.split('|').map(function(id){ return id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|');

    var regex     = "^https?:\\/\\/steamcommunity\\.com\\/+(id\\/+[A-Za-z0-9$-_.+!*'(),]+|profiles\\/+[0-9]+)\\/gamecards\\/"+blacklist+"\\/.+$";
    var re        = new RegExp(regex);

    // Get badge links
    gamecardHrefLinks = jQuery('div').find('.badge_row .badge_craft_button');
    gamecardHrefLinks.each(function() {
        var gamecardHrefLink = jQuery(this).attr('href');

        // Disable badge link
        if (gamecardHrefLink && re.test(gamecardHrefLink)) {
            jQuery('a[href="'+gamecardHrefLink+'"]').filter('.badge_craft_button').replaceWith('5 of 5 cards collected');
        }
    });

    // Redirect or clean up
    if (jQuery('.badge_craft_button').length >= 1) {
        redirect = 1;
    } else {
        delete window.sessionStorage.craftRecursive;
        jQuery('#autocraft').addClass('btn_disabled');
        jQuery('#autocraft').prop('disabled',true);
    }

    return jQuery.Deferred().resolve();
}

// Craft badge and refresh page
function craftBadge() {
    if (jQuery('.badge_craft_button.multicraft:visible').length) {
        jQuery('.badge_craft_button.multicraft').click();
    } else if (jQuery('.badge_craft_button:visible').length) {
        jQuery('.badge_craft_button').click();
    }
    if (isGameCardsPage === 1) {
        setTimeout(function(){ window.location.reload(true); }, craftRefreshTimeoutms);
    }
}

// Reset settings
function resetSettings() {
    var resetConfirm = confirm("Reset all settings?");
    if (resetConfirm === true) {
        pageRefreshTimeoutms  = pageRefreshTimeoutmsDef;
        delete window.localStorage.pageRefreshTimeoutms;
        jQuery('#autocraft_setting_refresh_timeout').val( pageRefreshTimeoutmsDef );

        craftRefreshTimeoutms = craftRefreshTimeoutmsDef;
        delete window.localStorage.craftRefreshTimeoutms;
        jQuery('#autocraft_setting_craft_refresh_timeout').val( craftRefreshTimeoutmsDef );

        gameIdBlackList = '';
        delete window.localStorage.gameIdBlackList;
        jQuery('#autocraft_setting_blacklist').val( gameIdBlackList );

        badgeCraftLimit = '';
        delete window.localStorage.badgeCraftLimit;
        jQuery('#autocraft_setting_badgelimit').val( badgeCraftLimit );

        toggleSettings();
        window.location.reload(true);
    }
}

// Save settings
function saveSettings() {
    var problemState  = 0;
    var settingsArray = jQuery('#autocraft_settings_form').serializeArray();

    jQuery.each(settingsArray, function (i, setting) {
        if (setting.name === 'autocraft_setting_refresh_timeout') {
            if (setting.value.match(/^[0-9]+$/)) {
                pageRefreshTimeoutms                     = setting.value;
                window.localStorage.pageRefreshTimeoutms = setting.value;
            } else {
                alert("Invalid input: "+setting.value+", 'Page Refresh Timeout (ms)' requires an integer!");
                problemState = 1;
            }
        }

        if (setting.name === 'autocraft_setting_craft_refresh_timeout') {
            if (setting.value.match(/^[0-9]+$/)) {
                craftRefreshTimeoutms                     = setting.value;
                window.localStorage.craftRefreshTimeoutms = setting.value;
            } else {
                alert("Invalid input: "+setting.value+", 'Craft Refresh Timeout (ms)' requires an integer!");
                problemState = 1;
            }
        }

        if (setting.name === 'autocraft_setting_blacklist') {
            if ((setting.value.match(/^([ \t]*,?[0-9]+,?[ \t]*)+$/)) || (setting.value === '')) {
                gameIdBlackList                     = setting.value;
                window.localStorage.gameIdBlackList = setting.value;
            } else {
                alert("Invalid input: "+setting.value+", 'Game ID Blacklist (id1,id2)' requires an integer with optional comma!");
                problemState = 1;
            }
        }

        if (setting.name === 'autocraft_setting_badgelimit') {
            if (((! setting.value.match(/^0$/)) && (setting.value.match(/^[0-9]+$/))) || (setting.value === '')) {
                badgeCraftLimit                     = setting.value;
                window.localStorage.badgeCraftLimit = setting.value;
            } else {
                alert("Invalid input: "+setting.value+", 'Badge Limit requires an integer greater than 0!");
                problemState = 1;
            }
        }

    });

    if (problemState === 0) {
        toggleSettings();
        window.location.reload(true);
    }
}

// Settings toggle
function toggleSettings() {
    jQuery('#autocraft_settings_div').toggle();
    jQuery('#autocraft_settings_background_div').fadeToggle();

    if (jQuery('#autocraft_settings_div').is(':visible')) {
        jQuery('#autocraft_settings').addClass('btn_disabled');
    } else {
        jQuery('#autocraft_settings').removeClass('btn_disabled');
    }

    var inside_autocraft_settings=false;

    jQuery('#autocraft_settings_div').hover(function(){
        inside_autocraft_settings=true;
    }, function(){
        inside_autocraft_settings=false;
    });

    jQuery('body').mouseup(function(){
        if((jQuery('#autocraft_settings_div').is(':visible')) && (!inside_autocraft_settings)) {
            jQuery('#autocraft_settings_div').hide();
            jQuery('#autocraft_settings_background_div').fadeOut();
            jQuery('#autocraft_settings').removeClass('btn_disabled');
        }
    });
}
