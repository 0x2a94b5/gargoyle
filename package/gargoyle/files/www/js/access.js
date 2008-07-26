/*
 * This program is copyright � 2008 Eric Bishop and is distributed under the terms of the GNU GPL 
 * version 2.0 with a special clarification/exception that permits adapting the program to 
 * configure proprietary "back end" software provided that all modifications to the web interface
 * itself remain covered by the GPL. 
 * See http://gargoyle-router.com/faq.html#qfoss for more information
 */

function saveChanges()
{
	errorList = proofreadAll();
	if(errorList.length > 0)
	{
		errorString = errorList.join("\n") + "\n\nChanges could not be applied.";
		alert(errorString);
	}
	else
	{
		document.body.style.cursor="wait";
		document.getElementById("save_button").style.display="none";
		document.getElementById("reset_button").style.display="none";
		document.getElementById("update_container").style.display="block";


		



		/* remove old remote accepts for SSH, HTTP and HTTPS from firewallData */
		dropbearSections = uciOriginal.getAllSections("dropbear");
		oldLocalSshPort = uciOriginal.get("dropbear", dropbearSections[0], "Port");
		oldLocalHttpsPort = uciOriginal.get("httpd_gargoyle", "server", "https_port");
		oldLocalHttpPort = uciOriginal.get("httpd_gargoyle", "server", "http_port");
		oldRemoteAccepts = firewallData[2];
		newRemoteAccepts = [];
		for(raIndex=0; raIndex < oldRemoteAccepts.length; raIndex++)
		{
			localPort = oldRemoteAccepts[raIndex][0];
			if(localPort != oldLocalSshPort && localPort != oldLocalHttpsPort && localPort != oldLocalHttpPort)
			{
				newRemoteAccepts.push(oldRemoteAccepts[raIndex]);
			}
		}
		
		/* add updated remote accepts */
		if(document.getElementById("remote_https_port_container").style.display != "none")
		{
			newRemoteAccepts.push( [ document.getElementById("local_https_port").value, document.getElementById("remote_https_port").value ]);
		}
		if(document.getElementById("remote_http_port_container").style.display != "none")
		{
			newRemoteAccepts.push( [ document.getElementById("local_http_port").value, document.getElementById("remote_http_port").value ]);
		}	
		if(!document.getElementById("remote_ssh_port").disabled)
		{
			newRemoteAccepts.push( [ document.getElementById("local_ssh_port").value, document.getElementById("remote_ssh_port").value ]);
		}	
		firewallData[2] = newRemoteAccepts;	
		
		//update dropbear and httpd_gargoyle uci configuration
		uci = uciOriginal.clone();



		uci.set("dropbear", dropbearSections[0], "Port", document.getElementById("local_ssh_port").value);
		dropbearRestart = oldLocalSshPort == document.getElementById("local_ssh_port").value ? "" : "/etc/init.d/dropbear restart\n"; //only restart dropbear if we need to


		//set web password enabled/disabled
		if(document.getElementById("disable_web_password").checked)
		{
			uci.set("httpd_gargoyle", "server", "no_password", "1");
		}
		else
		{
			uci.remove("httpd_gargoyle", "server", "no_password");

		}
		//set local web protocols
		localWebProtocol = getSelectedValue("local_web_protocol");
		uci.set("httpd_gargoyle", "server", "web_protocol", localWebProtocol);
		if(localWebProtocol == "https" || localWebProtocol == "both")
		{
			uci.set("httpd_gargoyle", "server", "https_port", document.getElementById("local_https_port").value);
		}
		if(localWebProtocol == "http" || localWebProtocol == "both")
		{
			uci.set("httpd_gargoyle", "server", "http_port", document.getElementById("local_http_port").value);
		}

		//password update
		passwordCommands = "";
		newPassword = document.getElementById("password1").value; 
		if(newPassword != "")
		{
			passwordCommands = "(echo \"" + newPassword + "\" ; sleep 1 ; echo \"" + newPassword + "\") | passwd root \n";
			dropBearRestart = "/etc/init.d/dropbear restart\n"; 
		}

		
		
		
		createFirewallCommands = getFirewallWriteCommands(firewallData, currentLanIp);
		restartFirewallCommand = "\nsh " + gargoyleBinRoot + "/utility/restart_firewall.sh ;\n";
		commands =passwordCommands + uci.getScriptCommands(uciOriginal) + "\n" + createFirewallCommands.join("\n") + "\n" + restartFirewallCommand + "\n" + dropbearRestart + "\nkillall httpd_gargoyle\n/etc/init.d/httpd_gargoyle restart\n";
		//document.getElementById("output").value = commands;


		var param = getParameterDefinition("commands", commands);
		runAjax("POST", "utility/run_commands.sh", param, function(){ return ""; });

		//we're going to assume user is connecting locally,
		//redirect for remote connections can get fubar, 
		//but there isn't a good way around that without
		//a lot of ugly code
		//
		//I figure 9 out of 10 times this is going to be run
		//locally.  If you're editing this remotely you're
		//just ASKING for trouble (i.e. you could easily get
		//shut out)
		doRedirect= function()
		{
			currentProtocol = location.href.match(/^https:/) ? "https" : "http";
			otherProtocol = currentProtocol == "https" ? "http" : "https";
			destinationProtocol = localWebProtocol == "both" || localWebProtocol == currentProtocol ? currentProtocol : otherProtocol;
			destinationPort = document.getElementById("local_" + destinationProtocol + "_port").value;
			accessPage = uciOriginal.get("gargoyle", "global", "bin_root") + "/" + uciOriginal.get("gargoyle", "scripts", "system_access");
			window.location= destinationProtocol + "://" + currentLanIp + ":" + destinationPort + "/" + accessPage;
		}
		setTimeout( "doRedirect()", 15000);
	}
}

function proofreadAll()
{
	
	controlIds=['local_https_port', 'local_http_port', 'local_ssh_port', 'remote_https_port', 'remote_http_port', 'remote_ssh_port'];
	validatePort = function(text){  return validateNumericRange(text,1,65535); };
	labelIds = [];
	functions = [];
	returnCodes = [];
	visibilityIds = [];
	
	for(idIndex = 0; idIndex < controlIds.length; idIndex++)
	{
		id=controlIds[idIndex];
		labelIds.push(id + "_label");
		functions.push(validatePort);
		returnCodes.push(0);
		visibilityIds.push(   id.match(/ssh/) ? id : id + "_container" ); //ssh control just gets disabled, while others have containers that become invisible	
	}
	errors = proofreadFields(controlIds, labelIds, functions, returnCodes, visibilityIds);
	


	localIds = ['local_https_port', 'local_http_port', 'local_ssh_port'];
	remoteIds = ['remote_https_port', 'remote_http_port', 'remote_ssh_port'];
	for(localIndex=0; localIndex < localIds.length; localIndex++)
	{
		localValue = document.getElementById(localIds[localIndex]).value;
		for(remoteIndex=0; remoteIndex < remoteIds.length; remoteIndex++)
		{
			remoteValue = document.getElementById(remoteIds[remoteIndex]).value;
			//alert ("local = " + localValue + ", remote = " + remoteValue +  ", localIndex = " + localIndex + ", remoteIndex = " + remoteIndex);
			if(remoteIndex != localIndex && remoteValue == localValue && remoteValue != "" && document.getElementById(remoteIds[remoteIndex]).disabled == false)
			{
				localName = document.getElementById( localIds[localIndex] + "_label").firstChild.data.replace(/:/, "");
				remoteName = 	document.getElementById( remoteIds[remoteIndex] + "_label").firstChild.data.replace(/:/, "");
				errors.push(remoteName + " cannot be " + localName);
			}
		}
		for(localIndex2=0; localIndex2 < localIds.length; localIndex2++)
		{
			localValue2 = document.getElementById(localIds[localIndex2]).value;
			//alert ("local = " + localValue + ", localValue2 = " + localValue2 +  ", localIndex = " + localIndex + ", localIndex2 = " + localIndex2);
			if(localIndex2 != localIndex && localValue2 == localValue && localValue2 !="" && document.getElementById(localIds[localIndex2]).disabled == false)
			{
				localName = document.getElementById( localIds[localIndex] + "_label").firstChild.data.replace(/:/, "");
				localName2 = 	document.getElementById( localIds[localIndex2] + "_label").firstChild.data.replace(/:/, "");
				errors.push(localName + " cannot be " + localName2);
			}
		}
	}


	pass1 = document.getElementById("password1").value;
	pass2 = document.getElementById("password2").value;
	if( (pass1 != "" || pass2 != "") && pass1 != pass2)
	{
		errors.push("Administrator password cannot be confirmed. Specified passwords are not equal.");
	}
	return errors;
}


function resetData()
{
	document.getElementById("disable_web_password").checked = uciOriginal.get("httpd_gargoyle", "server", "no_password") == "1" ? true : false;
	
	httpsPort = uciOriginal.get("httpd_gargoyle", "server", "https_port");
	httpPort = uciOriginal.get("httpd_gargoyle", "server", "http_port");
	localProtocol = uciOriginal.get("httpd_gargoyle", "server", "web_protocol");
	setSelectedValue("local_web_protocol", localProtocol);


	if(localProtocol == "https" ||  localProtocol == "both")
	{	
		document.getElementById("local_https_port").value = httpsPort;	
	}
	if(localProtocol == "http" || localProtocol == "both")
	{
		document.getElementById("local_http_port").value  = httpPort;
	}




	dropbearSections = uciOriginal.getAllSections("dropbear"); 
	sshPort = uciOriginal.get("dropbear", dropbearSections[0], "Port");
	document.getElementById("local_ssh_port").value = sshPort;





	remoteAccepts=firewallData[2];
	remoteHttpsPort = "";
	remoteHttpPort = "";
	remoteSshPort = "";
	for(acceptIndex = 0; acceptIndex < remoteAccepts.length; acceptIndex++)
	{
		localPort = remoteAccepts[acceptIndex][0];
		remotePort = remoteAccepts[acceptIndex][1];
		if(localPort == httpsPort)
		{
			remoteHttpsPort = remotePort;
		}
		else if(localPort == httpPort)
		{
			remoteHttpPort = remotePort;
		}
		else if(localPort == sshPort)
		{
			remoteSshPort = remotePort;
		}
	}
	


	allOptionValueHash=getRemoteOptionValueHash();
	setSelectElementOptions("remote_web_protocol", ["both", "https", "http", "disabled"], allOptionValueHash);
	if(remoteHttpsPort != "" && remoteHttpPort != "")
	{
		setSelectedValue("remote_web_protocol", "both");
	}
	else if(remoteHttpsPort != "")
	{
		setSelectedValue("remote_web_protocol", "https");
	}
	else if(remoteHttpPort != "")
	{
		setSelectedValue("remote_web_protocol", "http");
	}
	else
	{
		setSelectedValue("remote_web_protocol", "disabled");
	}
	document.getElementById("remote_https_port").value = remoteHttpsPort;
	document.getElementById("remote_http_port").value  = remoteHttpPort;
	document.getElementById("remote_ssh_port").value  = remoteSshPort;

	if(remoteSshPort != "")
	{
		document.getElementById("remote_ssh_enabled").checked = true;
	}
	else
	{
		document.getElementById("remote_ssh_enabled").checked = false;
	}
	
	
	
	
	//clear password fields
	document.getElementById("password1").value = "";
	document.getElementById("password2").value = "";


	//enable/disable proper fields
	updateVisibility();

}

function updateVisibility()
{
	localWebProtocol = getSelectedValue("local_web_protocol");
	localHttpsElement = document.getElementById("local_https_port");
	localHttpElement = document.getElementById("local_http_port");
	allOptionValueHash=getRemoteOptionValueHash();
	if(localWebProtocol == "both")
	{
		localHttpsElement.value = localHttpsElement.value == "" ? 443 : localHttpsElement.value;
		localHttpElement.value = localHttpElement.value == "" ? 80 : localHttpElement.value;
		setSelectElementOptions("remote_web_protocol", ["both", "https", "http", "disabled"], allOptionValueHash);
	}
	else if(localWebProtocol == "https")
	{
		localHttpsElement.value = localHttpsElement.value == "" ? 443 : localHttpsElement.value;
		localHttpElement.value = "";
		oldSelection = getSelectedValue("remote_web_protocol");
		setSelectElementOptions("remote_web_protocol", ["https", "disabled"], allOptionValueHash);
		if(oldSelection == "http")
		{
			setSelectedValue("remote_web_protocol", "disabled");
		}
	}
	else
	{
		localHttpsElement.value = "";
		localHttpElement.value = localHttpElement.value == "" ? 80 : localHttpElement.value;
		oldSelection = getSelectedValue("remote_web_protocol");
		setSelectElementOptions("remote_web_protocol", ["http", "disabled"], allOptionValueHash);
		if(oldSelection == "https")
		{
			setSelectedValue("remote_web_protocol", "disabled");
		}
	}



	remoteWebProtocol = getSelectedValue("remote_web_protocol");
	remoteHttpsElement = document.getElementById("remote_https_port");
	remoteHttpElement = document.getElementById("remote_http_port");
	if(remoteWebProtocol == "both")
	{
		remoteHttpsElement.value = remoteHttpsElement.value == "" ? localHttpsElement.value : remoteHttpsElement.value;
		remoteHttpElement.value = remoteHttpElement.value == "" ? localHttpElement.value : remoteHttpElement.value;
	}
	else if(remoteWebProtocol == "https")
	{
		remoteHttpsElement.value = remoteHttpsElement.value == "" ? localHttpsElement.value : remoteHttpsElement.value;
		remoteHttpElement.value = "";
	}
	else if(remoteWebProtocol == "http")
	{
		remoteHttpsElement.value = "";
		remoteHttpElement.value = remoteHttpElement.value == "" ? localHttpElement.value : remoteHttpElement.value;
	}
	else
	{
		remoteHttpsElement.value = "";
		remoteHttpElement.value = "";
	}

	ids= ["local_https_port", "local_http_port", "remote_https_port", "remote_http_port"];
	visIds=[];
	vis = [];
	for(idIndex = 0; idIndex < ids.length; idIndex++)
	{
		visIds.push(ids[idIndex] + "_container");
		vis.push( document.getElementById(ids[idIndex]).value != "" ? true : false );
	}
	setVisibility(visIds, vis);


	enableAssociatedField( document.getElementById("remote_ssh_enabled"), "remote_ssh_port", document.getElementById("local_ssh_port").value);
}

function setSelectElementOptions(selectId, enabledOptionValues, possibleOptionValueToTextHash)
{
	originalSelection = getSelectedValue(selectId);
	removeAllOptionsFromSelectElement(document.getElementById(selectId));
	for(addIndex=0; addIndex < enabledOptionValues.length; addIndex++)
	{
		optionValue = enabledOptionValues[addIndex];
		addOptionToSelectElement(selectId, possibleOptionValueToTextHash[optionValue], optionValue);
	}
	setSelectedValue(selectId, originalSelection);
	
}



function getRemoteOptionValueHash()
{
	allOptionValueHash=new Array();
	allOptionValueHash["both"]     = "HTTPS & HTTP";
	allOptionValueHash["https"]    = "HTTPS";
	allOptionValueHash["http"]     = "HTTP";
	allOptionValueHash["disabled"] = "Disabled";
	return allOptionValueHash;
}







