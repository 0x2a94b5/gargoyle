/*
 * This program is copyright � 2008 Eric Bishop and is distributed under the terms of the GNU GPL 
 * version 2.0 with a special clarification/exception that permits adapting the program to 
 * configure proprietary "back end" software provided that all modifications to the web interface
 * itself remain covered by the GPL. 
 * See http://gargoyle-router.com/faq.html#qfoss for more information
 */


function doUpgrade()
{
	if(!isRedboot && document.getElementById('upgrade_file').value.length == 0)
	{
		alert("ERROR: You must select a firmware file.");
	}
	else if(isRedboot && (document.getElementById('upgrade_file').value.length == 0 || document.getElementById('upgrade_file2').value.length == 0))
	{
		alert("ERROR: You must specify both firmware files.");

	}
	else
	{
		confirmUpgrade = window.confirm("This will erase your current settings, and may completely disable (\"brick\") your router if the firmware file is not valid.  Are you sure you want to continue?");
		if(confirmUpgrade)
		{
			document.getElementById('upgrade_form').submit();
			setControlsEnabled(false, true, "Uploading Firmware");
		}
	}
}

function uploaded()
{
	setControlsEnabled(false, true, "Upgrading, Please Wait.");
}
function upgraded()
{
	setControlsEnabled(false, true, "Upgrade Complete, Rebooting...");
	doRedirect= function()
	{
		window.location =  "http://192.168.1.1/";
	}
	setTimeout( "doRedirect()", 120*1000);
}




function failure()
{
	setControlsEnabled(true);
	alert("An error has occurred: Your router can not be upgraded.\n");

}

function setUpgradeFormat()
{
	if(isRedboot)
	{
		document.getElementById("upgrade_label").firstChild.data = "Select Root (squashfs/jffs) File:";
		document.getElementById("upgrade_file2_container").style.display="block";
	}
	else
	{
		document.getElementById("upgrade_label").firstChild.data = "Select (*.trx) Firmware File:";
	}

}
