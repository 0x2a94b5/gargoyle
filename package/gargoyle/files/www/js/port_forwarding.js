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

		var firewallSectionCommands = [];
		var redirectSectionTypes = ["redirect", "redirect_disabled"];
		for(typeIndex=0; typeIndex < redirectSectionTypes.length; typeIndex++)
		{
			var sectionType = redirectSectionTypes[typeIndex];
			var sections = uciOriginal.getAllSectionsOfType("firewall", sectionType);
			while(sections.length > 0)
			{
				var lastSection = sections.pop();
				uciOriginal.removeSection("firewall", lastSection);
				firewallSectionCommands.push("uci del firewall." + lastSection);
			}
		}
		

		var uci = uciOriginal.clone();
		

		var singlePortTable = document.getElementById('portf_table_container').firstChild;	
		var singlePortData= getTableDataArray(singlePortTable, true, false);	
		var enabledIndex = 0;
		var disabledIndex = 0;
		for(rowIndex = 0; rowIndex < singlePortData.length; rowIndex++)
		{

			var rowData = singlePortData[rowIndex];
			var enabled = rowData[5].checked;
			
			var protos = rowData[1].toLowerCase() == "both" ? ["tcp", "udp"] : [ rowData[1].toLowerCase() ];
			var protoIndex=0;
			for(protoIndex=0;protoIndex < protos.length; protoIndex++)
			{
				var id = "@" + (enabled ? "redirect" : "redirect_disabled") + "[" + (enabled ? enabledIndex : disabledIndex) + "]";
				firewallSectionCommands.push("uci add firewall " + (enabled ? "redirect" : "redirect_disabled"));

				uci.set("firewall", id, "", (enabled ? "redirect" : "redirect_disabled"));
				uci.set("firewall", id, "name", rowData[0]);
				uci.set("firewall", id, "src", "wan");
				uci.set("firewall", id, "dest", "lan");
				uci.set("firewall", id, "proto", protos[protoIndex]);
				uci.set("firewall", id, "src_dport", rowData[2]);
				uci.set("firewall", id, "dest_ip", rowData[3]);
				uci.set("firewall", id, "dest_port", rowData[4]);
				enabledIndex = enabledIndex + (enabled ? 1 : 0);
				disabledIndex = disabledIndex + (enabled ? 0 : 1);
			}
		}


		var portRangeTable = document.getElementById('portfrange_table_container').firstChild;	
		var portRangeData= getTableDataArray(portRangeTable, true, false);	
		for(rowIndex = 0; rowIndex < portRangeData.length; rowIndex++)
		{
			var rowData = portRangeData[rowIndex];
			var enabled = rowData[5].checked;
			var id = "@" + (enabled ? "redirect" : "redirect_disabled") + "[" + (enabled ? enabledIndex : disabledIndex) + "]";
			firewallSectionCommands.push("uci add firewall " + (enabled ? "redirect" : "redirect_disabled"));

			var protos = rowData[1].toLowerCase() == "both" ? ["tcp", "udp"] : [ rowData[1].toLowerCase() ];
			var protoIndex=0;
			for(protoIndex=0;protoIndex < protos.length; protoIndex++)
			{
				uci.set("firewall", id, "", (enabled ? "redirect" : "redirect_disabled"));
				uci.set("firewall", id, "name", rowData[0]);
				uci.set("firewall", id, "src", "wan");
				uci.set("firewall", id, "dest", "lan");
				uci.set("firewall", id, "proto", protos[protoIndex]);
				uci.set("firewall", id, "src_dport", rowData[2] + "-" + rowData[3]);
				uci.set("firewall", id, "dest_ip", rowData[4]);
			
				enabledIndex = enabledIndex + (enabled ? 1 : 0);
				disabledIndex = disabledIndex + (enabled ? 0 : 1);
			}
		}

		
		//dmz
		//firewallData[3] = document.getElementById('dmz_enabled').checked ? document.getElementById('dmz_ip').value : null;
		if(document.getElementById('dmz_enabled').checked )
		{
			var id = "@redirect[-1]";
			firewallSectionCommands.push("uci add firewall redirect");
			
			uci.set("firewall", id, "", "redirect");
			uci.set("firewall", id, "src", "wan");
			uci.set("firewall", id, "dest", "lan");
			uci.set("firewall", id, "dest_ip", document.getElementById('dmz_ip').value);
		}
		firewallSectionCommands.push("uci commit");
			
		restartFirewallCommand = "\nsh " + gargoyleBinRoot + "/utility/restart_firewall.sh ;\n";


		//upnp
		upnpStartCommands = new Array();
		upnpStartCommands.push("/etc/init.d/miniupnpd stop");
		upnpdEnabled = document.getElementById("upnp_enabled").checked;
		if(upnpdEnabled)
		{
			upnpStartCommands.push("/etc/init.d/miniupnpd enable");
			uci.set("upnpd", "config", "upload", document.getElementById("upnp_up").value);
			uci.set("upnpd", "config", "download", document.getElementById("upnp_down").value);
			upnpStartCommands.push("/etc/init.d/miniupnpd start");
		}
		else
		{
			upnpStartCommands.push("/etc/init.d/miniupnpd disable");
		}
	

		commands = firewallSectionCommands.join("\n") + "\n" + uci.getScriptCommands(uciOriginal) + "\n" + restartFirewallCommand + "\n" + upnpStartCommands.join("\n");
		//document.getElementById("output").value = commands;


		var param = getParameterDefinition("commands", commands);
		var stateChangeFunction = function(req)
		{
			if(req.readyState == 4)
			{
				uciOriginal = uci.clone();
				resetData();
				document.getElementById("update_container").style.display="none";		
				document.getElementById("save_button").style.display="inline";
				document.getElementById("reset_button").style.display="inline";
				document.body.style.cursor='auto';
		
				//alert(req.responseText);
			}
		}
		runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);
	}
}

function proofreadAll()
{
	controlIds=['dmz_ip', 'upnp_up', 'upnp_down'];
	labelIds= ['dmz_ip_label', 'upnp_up_label', 'upnp_down_label'];
	functions = [validateIP, validateNumeric, validateNumeric];
	returnCodes = [0,0,0];
	visibilityIds=controlIds;
	errors = proofreadFields(controlIds, labelIds, functions, returnCodes, visibilityIds);
	return errors;
}

function addPortfRule()
{
	errors = proofreadAdd();
	if(errors.length > 0)
	{
		alert(errors.join("\n") + "\n\nCould not add forwarding rule.");
	}
	else
	{
		values = new Array();
		ids = ['add_app', 'add_prot', 'add_fp', 'add_ip', 'add_dp'];
		for (idIndex in ids)
		{
			element = document.getElementById(ids[idIndex]);
			v = element.value;
			v = v== '' ? '-' : v;
			values.push(v);
			if(element.type == "text")
			{
				element.value = "";
			}
		}
		values[4] = values[4] == '-' ? values[2] : values[4];
		


		//check if this is identical to another rule, but for a different protocol
		//if so, just merge the two by setting the protocol on the old data to 'Both'
		//
		portfTable = document.getElementById('portf_table_container').firstChild;
		currentPortfData = getTableDataArray(portfTable, true, false);
		otherProto = values[1] == 'TCP' ? 'UDP' : 'TCP';
		mergedWithExistingRule = false;
		for (rowDataIndex in currentPortfData)
		{
			rowData = currentPortfData[rowDataIndex];
			
			if( otherProto == rowData[1] &&  values[2] == rowData[2] && values[3] == rowData[3] && values[4] == rowData[4])
			{

				portfTable.rows[(rowDataIndex*1)+1].childNodes[1].firstChild.data = 'Both';
				if(values[0] != '-' && rowData[0] == '-')
				{
					portfTable.rows[(rowDataIndex*1)+1].childNodes[0].firstChild.data = values[0];
				}
				
				table1Container = document.getElementById('portf_table_container');
				if(table1Container.firstChild != null)
				{
					table1Container.removeChild(table1Container.firstChild);
				}
				table1Container.appendChild(portfTable);

				mergedWithExistingRule = true;
			}
		}

		if(!mergedWithExistingRule)
		{
			checkbox = createInput('checkbox');
			checkbox.checked = true;
			values.push(checkbox);
			addTableRow(portfTable,values, true, false);
		}
	}
}



function addPortfRangeRule()
{
	errors = proofreadAddRange();
	if(errors.length > 0)
	{
		alert(errors.join("\n") + "\n\nCould not add forwarding rule.");
	}
	else
	{
		values = new Array();
		ids = ['addr_app', 'addr_prot', 'addr_sp', 'addr_ep', 'addr_ip'];
		for (idIndex in ids)
		{
			element = document.getElementById(ids[idIndex]);
			v = element.value;
			v = v== '' ? '-' : v;
			values.push(v);
			if(element.type == 'text')
			{
				element.value = "";
			}
		}

		portfRangeTable = document.getElementById('portfrange_table_container').firstChild;
		currentRangeData = getTableDataArray(portfRangeTable, true, false);
		otherProto = values[1] == 'TCP' ? 'UDP' : 'TCP';
		mergedWithExistingRule = false;
		for (rowDataIndex in currentRangeData)
		{
			rowData = currentRangeData[rowDataIndex];
			if( otherProto == rowData[1] &&  values[2] == rowData[2] && values[3] == rowData[3] && values[4] == rowData[4])
			{
				portfRangeTable.rows[(rowDataIndex*1)+1].childNodes[1].firstChild.data = 'Both';
				if(values[0] != '-' && rowData[0] == '-')
				{
					portfRangeTable.rows[(rowDataIndex*1)+1].childNodes[0].firstChild.data = values[0];
				}
				
				table2Container = document.getElementById('portfrange_table_container');
				if(table2Container.firstChild != null)
				{
					table2Container.removeChild(table2Container.firstChild);
				}
				table2Container.appendChild(portfRangeTable);

				mergedWithExistingRule = true;

			}
		}


		if(!mergedWithExistingRule)
		{
			checkbox = createInput('checkbox');	
			checkbox.checked = true;
			values.push(checkbox);

			portfrangeTable = document.getElementById('portfrange_table_container').firstChild;
			addTableRow(portfrangeTable,values, true, false);
		}
	}
}

function proofreadAddRange()
{
	addIds = ['addr_sp', 'addr_ep', 'addr_ip'];
	labelIds = ['addr_sp_label', 'addr_ep_label', 'addr_ip_label'];
	functions = [validateNumeric, validateNumeric, validateIP];
	returnCodes = [0,0,0];
	visibilityIds = addIds;
	errors = proofreadFields(addIds, labelIds, functions, returnCodes, visibilityIds);
	if(errors.length == 0)
	{
		if( (1*document.getElementById('addr_sp').value) > (1*document.getElementById('addr_ep').value) )
		{
			errors.push("Start Port > End Port");
		}
		
		
		portfTable = document.getElementById('portf_table_container').firstChild;
		currentPortfData = getTableDataArray(portfTable, true, false);
		addStartPort = document.getElementById('addr_sp').value;
		addEndPort = document.getElementById('addr_ep').value;
		addProtocol = document.getElementById('addr_prot').value;
		for (rowDataIndex in currentPortfData)
		{
			rowData = currentPortfData[rowDataIndex];
			if( (addProtocol == rowData[1] || addProtocol == 'Both' || rowData[1] == 'Both') &&  addStartPort*1 <= rowData[2]*1 && addEndPort*1 >= rowData[2]*1 )
			{
				errors.push("Port(s) Within Range Is/Are Already Being Forwarded");
			}
		}

		portfRangeTable = document.getElementById('portfrange_table_container').firstChild;
		currentRangeData = getTableDataArray(portfRangeTable, true, false);
		for (rowDataIndex in currentRangeData)
		{
			rowData = currentRangeData[rowDataIndex];
			if( (addProtocol == rowData[1] || addProtocol == 'Both' || rowData[1] == 'Both') && rowData[2]*1 <= addEndPort*1 && rowData[3]*1 >= addStartPort*1)
			{
				errors.push("Port(s) Within Range Is/Are Already Being Forwarded");
			}
		}
	}

	
	return errors;

}

function proofreadAdd()
{
	
	addIds = ['add_fp', 'add_ip'];
	labelIds = ['add_fp_label', 'add_ip_label', 'add_dp_label'];
	functions = [validateNumeric, validateIP, validateNumeric];
	returnCodes = [0,0,0];
	visibilityIds = addIds;
	if(document.getElementById('add_dp').value.length > 0)
	{
		addIds.push('add_dp');
	}
	errors = proofreadFields(addIds, labelIds, functions, returnCodes, visibilityIds);



	if(errors.length == 0)
	{
		portfTable = document.getElementById('portf_table_container').firstChild;
		currentPortfData = getTableDataArray(portfTable, true, false);
		addPort = document.getElementById('add_fp').value;
		addProtocol = document.getElementById('add_prot').value;
		for (rowDataIndex in currentPortfData)
		{
			rowData = currentPortfData[rowDataIndex];
			if( (addProtocol == rowData[1] || addProtocol == 'Both' || rowData[1] == 'Both') &&  addPort == rowData[2])
			{
				errors.push("Port Is Already Being Forwarded");
			}
		}

		portfRangeTable = document.getElementById('portfrange_table_container').firstChild;
		currentRangeData = getTableDataArray(portfRangeTable, true, false);
		for (rowDataIndex in currentRangeData)
		{
			rowData = currentRangeData[rowDataIndex];
			if( (addProtocol == rowData[1] || addProtocol == 'Both' || rowData[1] == 'Both') && rowData[2]*1 <= addPort*1 && rowData[3]*1 >= addPort*1)
			{
				errors.push("Port Is Already Being Forwarded");
			}
		}
	}

	return errors;
}

function resetData()
{
	
	var singlePortTableData = new Array();
	var portRangeTableData = new Array();
	var singlePortEnabledStatus = new Array();
	var portRangeEnabledStatus = new Array();
	var dmzIp = "";

	var singlePortProtoHash = [];
	var portRangeProtoHash = [];
	singlePortProtoHash["tcp"] = [];
	singlePortProtoHash["udp"] = [];
	portRangeProtoHash["tcp"] = [];
	portRangeProtoHash["udp"] = [];


	// parse (both enabled & disabled) redirects
	// uci firewall doesn't parse redirect_disabled sections, so we can store this info there
	// without any complications.  Likewise we store rule name in "name" variable that doesn't
	// get parsed by the uci firewall script.
	var redirectSectionTypes = ["redirect", "redirect_disabled"];
	for(typeIndex=0; typeIndex < redirectSectionTypes.length; typeIndex++)
	{
		var sectionType = redirectSectionTypes[typeIndex];
		var redirectSections = uciOriginal.getAllSectionsOfType("firewall", redirectSectionTypes[typeIndex]);
		for(rdIndex=0; rdIndex < redirectSections.length; rdIndex++)
		{
			var rId = redirectSections[rdIndex];
			var name = uciOriginal.get("firewall", rId, "name");
			name = name == "" ? "-" : name;
			var proto	= uciOriginal.get("firewall", rId, "proto").toLowerCase();
			var srcdport	= uciOriginal.get("firewall", rId, "src_dport");
			var destip	= uciOriginal.get("firewall", rId, "dest_ip");
			var destport	= uciOriginal.get("firewall", rId, "dest_port");
	
			
			if(srcdport == "" && destport == "" && sectionType == "redirect")
			{	
				dmzIp = dmzIp == "" ? destip : dmzIp;
			}
			else if(proto.toLowerCase() == "tcp" || proto.toLowerCase() == "udp")
			{
				checkbox = createInput('checkbox');
				checkbox.checked = sectionType == "redirect" ? true : false;

				destport = destport == "" ? srcdport : destport;
				otherProto = proto == "tcp" ? "udp" : "tcp";
				hashStr = name + "-" + srcdport + "-" + destip + "-" + destport;
				if(srcdport.match(/-/))
				{
					var splitPorts = srcdport.split(/-/);
					// if same rule, different protocol exists, merge into one rule
					// otherwise, add rule to table data
					if(portRangeProtoHash[otherProto][hashStr] != null)
					{
						portRangeProtoHash[otherProto][hashStr][1] = "Both";
					}
					else
					{
						var nextTableRowData = [name, proto.toUpperCase(), splitPorts[0], splitPorts[1], destip, checkbox];
						portRangeTableData.push(nextTableRowData);
						portRangeProtoHash[proto][hashStr] = nextTableRowData;
						portRangeEnabledStatus.push(checkbox.checked);
					}
				}
				else
				{
					// if same rule, different protocol exists, merge into one rule
					// otherwise, add rule to table data
					if(singlePortProtoHash[otherProto][hashStr] != null)
					{
						singlePortProtoHash[otherProto][hashStr][1] = "Both";
					}
					else
					{
						var nextTableRowData = [name, proto.toUpperCase(), srcdport, destip, destport, checkbox];
						singlePortTableData.push(nextTableRowData);
						singlePortProtoHash[proto][hashStr] = nextTableRowData;
						singlePortEnabledStatus.push(checkbox.checked);
					}
				}
			}
		}
	}


	columnNames = ['Application', 'Protocol', 'From Port', 'To IP', 'To Port', 'Enabled']
	portfTable=createTable(columnNames, singlePortTableData, "portf_table", true, false);
	table1Container = document.getElementById('portf_table_container');
	
	if(table1Container.firstChild != null)
	{
		table1Container.removeChild(table1Container.firstChild);
	}
	table1Container.appendChild(portfTable);
	
	
	
	

	columnNames = ['Application', 'Protocol', 'Start Port', 'End Port', 'To IP', 'Enabled']
	portfrangeTable=createTable(columnNames, portRangeTableData, "portf_range_table", true, false);
	table2Container = document.getElementById('portfrange_table_container');
	if(document.getElementById('portfrange_table_container').firstChild != null)
	{
		table2Container.removeChild(table2Container.firstChild);
	}
	table2Container.appendChild(portfrangeTable);



	// Because IE6 was designed by programmers whose only qualification was participation in the Special Olympics,
	// checkboxes become unchecked when added to table.  We need to reset checked status here.
	for(spIndex = 0; spIndex < singlePortEnabledStatus.length; spIndex++)
	{
		singlePortTableData[spIndex][5].checked = singlePortEnabledStatus[spIndex];
	}
	for(prIndex = 0; prIndex < portRangeEnabledStatus.length; prIndex++)
	{
		portRangeTableData[prIndex][5].checked = portRangeEnabledStatus[prIndex];
	}



	clearIds = ['add_app', 'add_fp', 'add_ip', 'add_dp', 'addr_app', 'addr_sp', 'addr_ep', 'addr_ip'];
	for(clearIndex = 0; clearIndex < clearIds.length; clearIndex++)
	{
		document.getElementById(clearIds[clearIndex]).value = '';
	}


	//dmz
	document.getElementById("dmz_enabled").checked = (dmzIp != "");
	if( dmzIp != "")
	{
		document.getElementById("dmz_ip").value = dmzIp;
	}
	else
	{
		var defaultDmz = (currentLanIp.split(/\.[^\.]*$/))[0];
		var lanIpEnd = parseInt((currentLanIp.split("."))[3]);
		if(lanIpEnd >= 254)
		{
			lanIpEnd--;
		}
		else
		{
			lanIpEnd++;
		}
		defaultDmz = defaultDmz + "." + lanIpEnd;
		document.getElementById("dmz_ip").value = defaultDmz;
	}
	setDmzEnabled();

	


	

	//upnp
	document.getElementById("upnp_enabled").checked = upnpdEnabled;
	upElement = document.getElementById("upnp_up");
	downElement = document.getElementById("upnp_down");
	
	upElement.value = uciOriginal.get("upnpd", "config", "upload");
	upElement.value = upElement.value == '' ? 512 : upElement.value;
	
	downElement.value = uciOriginal.get("upnpd", "config", "download");
	downElement.value = downElement.value == '' ? 1024 : downElement.value;

	setUpnpEnabled();
	
}

function setUpnpEnabled()
{
	enableAssociatedField(document.getElementById("upnp_enabled"), 'upnp_up', document.getElementById('upnp_up').value);
	enableAssociatedField(document.getElementById("upnp_enabled"), 'upnp_down', document.getElementById('upnp_down').value);
}

function setDmzEnabled()
{
	enableAssociatedField(document.getElementById("dmz_enabled"), 'dmz_ip', document.getElementById('dmz_ip').value);
}
