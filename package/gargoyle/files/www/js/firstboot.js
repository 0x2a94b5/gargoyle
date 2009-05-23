/*
 * This program is copyright � 2008 Eric Bishop and is distributed under the terms of the GNU GPL 
 * version 2.0 with a special clarification/exception that permits adapting the program to 
 * configure proprietary "back end" software provided that all modifications to the web interface
 * itself remain covered by the GPL. 
 * See http://gargoyle-router.com/faq.html#qfoss for more information
 */


function setPassword()
{
	var p1 = document.getElementById("password1").value;
	var p2 = document.getElementById("password2").value;
	if(p1.length == 0 && p2.length == 0)
	{
		alert("ERROR: You must specify a password");
	}
	else if(p1 != p2)
	{
		alert("ERROR: Passwords do not match");
	}
	else
	{

		setControlsEnabled(false, true);

		var passwordCommands = "";
		passwordCommands = "(echo \"" + p1 + "\" ; sleep 1 ; echo \"" + p1 + "\") | passwd root \n";
		passwordCommands = passwordCommands + "\n/etc/init.d/dropbear restart\n";
		passwordCommands = passwordCommands + "\neval $( gargoyle_session_validator -g -a \"" + httpUserAgent + "\" -i \"" + remoteAddr +"\" )";
		passwordCommands = passwordCommands + "\nuci del gargoyle.global.is_first_boot\nuci commit\n";

		
		var param = getParameterDefinition("commands", passwordCommands)  + "&" + getParameterDefinition("hash", document.cookie.replace(/^.*hash=/,"").replace(/[\t ;]+.*$/, ""));

		var stateChangeFunction = function(req)
		{
			if(req.readyState == 4)
			{
				
				var hashCookie = "";
				var expCookie  = "";
				var responseLines = req.responseText.split(/[\r\n]+/);
				var rIndex=0;
				for(rIndex=0; rIndex < responseLines.length; rIndex++)
				{
					if(responseLines[rIndex].match(/hash=/))
					{
						hashCookie = responseLines[rIndex].replace(/^.*hash=/, "").replace(/[;\t ]+/, "");
					}
					if(responseLines[rIndex].match(/exp=/))
					{
						expCookie = responseLines[rIndex].replace(/^.*exp=/, "").replace(/[;\t ]+/, "");
					}
				}
				
				document.cookie="hash=" + hashCookie;
				document.cookie="exp="  + expCookie;
			
				currentProtocol = location.href.match(/^https:/) ? "https" : "http";
				window.location= currentProtocol + "://" + window.location.host + "/basic.sh";
			}
		}
		runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);
	}
}



