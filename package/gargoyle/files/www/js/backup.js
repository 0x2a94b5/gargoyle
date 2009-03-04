/*
 * This program is copyright � 2008 Eric Bishop and is distributed under the terms of the GNU GPL 
 * version 2.0 with a special clarification/exception that permits adapting the program to 
 * configure proprietary "back end" software provided that all modifications to the web interface
 * itself remain covered by the GPL. 
 * See http://gargoyle-router.com/faq.html#qfoss for more information
 */

function getBackup()
{
	setControlsEnabled(false, true);
	var param = getParameterDefinition("commands", "sh " + gargoyleBinRoot + "/utility/create_backup.sh ;\n" );
	var stateChangeFunction = function(req)
	{
		if(req.readyState == 4)
		{
			setControlsEnabled(true);
			window.location="backup.tar.gz"
		}
	}
	runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);
}

function doRestore()
{
	if(document.getElementById('restore_file').value.length == 0)
	{
		alert("ERROR: You must select a configuration file to restore from.");
	}
	else
	{
		confirmRestore = window.confirm("This will completely erase your current settings and replace them with new ones from the selected configuration file.  Are you sure you want to continue?");
		if(confirmRestore)
		{
			setControlsEnabled(false, true);	
			document.getElementById('restore_form').submit();
		}
	}
}

function restoreFailed()
{
	setControlsEnabled(true);
	alert("Restore failed.  Ensure that uploaded file is a valid Gargoyle configuration file and try again.");
}

function restoreSuccessful(lanIp)
{
	setControlsEnabled(false, true, "Configuration file uploaded successfully. Please wait while your new settings are applied");

	var param = getParameterDefinition("commands", "sh " + gargoyleBinRoot + "/utility/restart_everything.sh ;\n" );
	var stateChangeFunction = function(req) { return 0; } ;
	runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);

		
	doRedirect= function()
	{
		currentProtocol = location.href.match(/^https:/) ? "https" : "http";
		window.location = currentProtocol + "://" + lanIp + ":" + window.location.port + window.location.pathname;
	}
	setTimeout( "doRedirect()", 30000);
	
}
