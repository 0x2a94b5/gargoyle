/*
 * This program is copyright © 2008-2012 Eric Bishop and is distributed under the terms of the GNU GPL 
 * version 2.0 with a special clarification/exception that permits adapting the program to 
 * configure proprietary "back end" software provided that all modifications to the web interface
 * itself remain covered by the GPL. 
 * See http://gargoyle-router.com/faq.html#qfoss for more information
 */


function saveChanges()
{
	var errorList = proofreadAll();
	if(errorList.length > 0)
	{
		errorString = errorList.join("\n") + "\n\nChanges could not be applied.";
		alert(errorString);
	}
	else
	{
		setControlsEnabled(false, true);
		var uci = uciOriginal.clone();
		var commands = "";
		
		var param = getParameterDefinition("commands", commands) + "&" + getParameterDefinition("hash", document.cookie.replace(/^.*hash=/,"").replace(/[\t ;]+.*$/, ""));
	
		var stateChangeFunction = function(req)
		{
			if(req.readyState == 4)
			{
				setControlsEnabled(true)
			}
		}
		runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);
	}
}


function proofreadAll()
{
	var errors = []
	return errors;
}



function resetData()
{
	var serverEnabled = uciOriginal.get("openvpn_gargoyle", "server", "enabled") 
	var clientEnabled = uciOriginal.get("openvpn_gargoyle", "server", "enabled")
	serverEnabled = serverEnabled == "true" || serverEnabled == "1" ? true : false;
	clientEnabled = clientEnabled == "true" || clientEnabled == "1" ? true : false;
	
	var openvpnMode = "disabled"
	openvpnMode = serverEnabled ? "server" : openVpnMode
	openvpnMode = clientEnabled ? "client" : openVpnMode
	setSelectedValue("openvpn_config", openVpnMode)

	
	getServerVarWithDefault = function(variable, defaultDef) {
		var def = uciOriginal.get("openvpn_gargoyle", "server", variable)
		def = def == "" ? defaultDef : def
		return def
	}

	document.getElementById("openvpn_server_ip").value = getServerVarWithDefault("internal_ip", "10.8.0.1")
	document.getElementById("openvpn_server_mask").value = getServerVarWithDefault("internal_mask", "255.255.255.0")
	document.getElementById("openvpn_server_port").value = getServerVarWithDefault("port", "1194")

	
	var serverCipher  = uciOriginal.get("openvpn_gargoyle", "server", "cipher")
	var serverKeysize = uciOriginal.get("openvpn_gargoyle", "server", "keysize")
	if(serverCipher == "")
	{
		serverCipher = "BF-CBC"
		serverKeysize = "128"
	}
	serverCipher = serverKeysize == "" ? serverCipher : serverCipher + ":" + serverKeysize

	setSelectedValue("openvpn_server_protocol", getServerVarWithDefault("proto", "udp"))
	setSelectedValue("openvpn_server_cipher", serverCipher)
	setSelectedValue("openvpn_server_client_to_client", getServerVarWithDefault("client_to_client", "false"))
	setSelectedValue("openvpn_server_subnet_access", getServerVarWithDefault("subnet_access", "false"))
	setSelectedValue("openvpn_server_duplicate_cn", getServerVarWithDefault("duplicate_cn", "false"))
	setSelectedValue("openvpn_server_redirect_gateway", getServerVarWithDefault("redirect_gateway", "true"))



	setOpenvpnVisibility()
}

function setOpenvpnVisibility
{
	openvpnMode = getSelectedValue("openvpn_config");
	
	document.getElementById("openvpn_server_fieldset").style.display         = openvpnMode == "server" ? "block" : "none";
	document.getElementById("openvpn_allowed_client_fieldset").style.display = openvpnMode == "server" ? "block" : "none";
	document.getElementById("openvpn_client_fieldset").style.display         = openvpnMode == "client" ? "block" : "none";
	
	setAllowedClientVisibility(document);
}

function setAllowedClientVisibility( controlDocument )
{
	controlDocument.getElementById("openvpn_allowed_client_remote_custom_container").style.display = getSelectedValue("openvpn_allowed_client_remote", controlDocument) == "custom" ? "block" : "none";

	controlDocument.getElementById("openvpn_allowed_client_subnet_container").style.display = getSelectedValue("openvpn_allowed_client_have_subnet", controlDocument) == "true" ? "block" : "none";
}

