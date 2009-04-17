/*
 * This program is copyright � 2008 Eric Bishop and is distributed under the terms of the GNU GPL 
 * version 2.0 with a special clarification/exception that permits adapting the program to 
 * configure proprietary "back end" software provided that all modifications to the web interface
 * itself remain covered by the GPL. 
 * See http://gargoyle-router.com/faq.html#qfoss for more information
 */

var scannedSsids = [[],[],[],[]];
var toggleReload = false;
var currentLanIp;

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
		//let user know if we're rebooting -- broadcom wifi can be restarted
		//without rebooting, but under certain conditions atheros devices shit themselves
		if(wirelessDriver == "broadcom")
		{
			setControlsEnabled(false, true, "Please Wait While Settings Are Applied");
		}
		else
		{
			setControlsEnabled(false, true, "Please Wait While Settings Are Applied And Device Is Restarted");
		}

		var uci = uciOriginal.clone();
		var uciCompare = uciOriginal.clone();




		var preCommands = "";	
		var allWirelessSections = uci.getAllSections("wireless");
		var allWifiDeviceSections = uci.getAllSectionsOfType("wireless", "wifi-device");
		var firstWirelessDevice = allWifiDeviceSections[0];
		
		if(firstWirelessDevice == null)
		{
			while(allWirelessSections.length > 0)
			{
				var sectionName = allWirelessSections.shift();
				preCommands = preCommands + "uci del wireless." + sectionName + "\n";
				uci.removeSection("wireless", sectionName);
				uciCompare.removeSection("wireless", sectionName);
			}
			preCommands = preCommands + "uci commit\n";

			firstWirelessDevice = wirelessDriver == "broadcom" ? "wl0" : "wifi0";
			preCommands = preCommands + "uci set wireless." + firstWirelessDevice + "=wifi-device\n";
			preCommands = preCommands + "uci set wireless." + firstWirelessDevice + ".type=" + wirelessDriver + "\n";
			preCommands = preCommands + "uci commit\n";
			uci.set("wireless", firstWirelessDevice, "", "wifi-device");
			uci.set("wireless", firstWirelessDevice, "type", wirelessDriver);
		}
		
		//clear all old wifi-iface sections
		var wifiDelIndex=0;
		for(wifiDelIndex=0; wifiDelIndex < allWirelessSections.length; wifiDelIndex++)
		{
			var delSection = allWirelessSections[wifiDelIndex];
			if(uci.get("wireless", delSection, "") == "wifi-iface")
			{
				uci.removeSection("wireless", delSection);
				uciCompare.removeSection("wireless", delSection);
				preCommands = preCommands + "uci del wireless." + delSection + "\n";
			}
		}
		preCommands = preCommands + "uci commit \n";
		
		
		//always remove this option, if wireless is set to disabled merely delete all interface sections
		uci.remove('wireless', firstWirelessDevice, 'disabled'); 


		currentLanIp = "";
		var adjustIpCommands = ""
		var bridgeEnabledCommands = "";
		if( document.getElementById("global_router").checked )
		{
			currentLanIp = document.getElementById("lan_ip").value;
			if(getSelectedValue('wan_protocol') == 'none')
			{
				preCommands = preCommands + "\nuci del network.wan\nuci commit\n";
				uci.removeSection("network", "wan");
				uciCompare.removeSection("network", "wan");
			}
			else
			{
				preCommands = preCommands + "\nuci set network.wan=interface\n";
				uci.remove('network', 'wan', 'type');
				if(getSelectedValue("wan_protocol").match(/wireless/))
				{
					uci.remove('network', 'wan', 'ifname');
					uci.set('network', 'wan', 'type', 'bridge');
				}
				else if(getSelectedValue('wan_via_single_port')=="wan" && document.getElementById('wan_via_single_port_container').style.display != "none" )
				{
					uci.set('network', 'wan', 'ifname', defaultLanIf);
				}
				else
				{
					uci.set('network', 'wan', 'ifname', defaultWanIf);
				}
			}
			
			
			
			if( document.getElementById("wan_port_to_lan_container").style.display != "none" && getSelectedValue('wan_port_to_lan') == "bridge" )
			{
				uci.set('network', 'lan', 'ifname', defaultLanIf + " " + defaultWanIf);
			}
			else if(getSelectedValue('wan_via_single_port')=="wan" && document.getElementById('wan_via_single_port_container').style.display != "none" )
			{
				//just in case wirelessIf doesn not exist, remove variable first
				uci.remove('network', 'lan', 'ifname');
				uci.set('network', 'lan', 'ifname', wirelessIf);
			}
			else 
			{
				uci.set('network', 'lan', 'ifname', defaultLanIf);
			}

		



			//define new sections, now that we have cleared old ones
			//cfg2 should be AP if we have an AP section, otherwise cfg2 is whatever single mode we are in
			currentModes= getSelectedValue('wifi_mode');
			var section1 = '';
			var section2 = '';
			if(currentModes.match(/ap/))
			{
				section1 = 'cfg2';
				uci.set("wireless", "cfg2", "", "wifi-iface");
				uci.set("wireless", "cfg2", "device", firstWirelessDevice);
				uci.set('wireless', section1, 'mode', 'ap');
				uci.set('wireless', section1, 'network', 'lan');

				preCommands = preCommands + "uci set wireless.cfg2='wifi-iface' \n"
	
				if(currentModes == "ap+wds") //non-ap sections for ap+wds
				{
					var wdsData = getTableDataArray(document.getElementById('wifi_wds_mac_table_container').firstChild, 1, 0);
					var wdsList = [];
					var wIndex=0;
					for(wIndex=0; wIndex< wdsData.length; wIndex++)
					{
						wdsList.push( wdsData[wIndex][0] );
					}

					if(wirelessDriver == "broadcom")
					{
						//add one section for each bssid
						var encryption = getSelectedValue("wifi_encryption1");
						var key = encryption == "none" ? "" : ( encryption == "wep" ? document.getElementById("wifi_wep1").value : document.getElementById("wifi_pass1").value );
						var ssid = document.getElementById("wifi_ssid1").value;
						var wIndex=0;
						for(wIndex=0; wIndex < wdsList.length; wIndex++)
						{
							var sectionIndex=wIndex + 3;
							var section = "cfg" + sectionIndex;
							uci.set("wireless", section, "", "wifi-iface");
							uci.set("wireless", section, "device", firstWirelessDevice);
							uci.set("wireless", section, "network", "lan");
							uci.set("wireless", section, "mode", "wds");
							uci.set("wireless", section, "ssid", ssid);
							uci.set("wireless", section, "bssid", wdsList[wIndex].toLowerCase());
							uci.set("wireless", section, "encryption", encryption);
							if(encryption != "none") { uci.set("wireless", section, "key", key); }
							preCommands = preCommands + "\nuci set wireless." + section + "=wifi-iface\n";
						}	
					}
					else
					{
						uci.set("wireless", section1, "bssid", wdsList.join(" ").toLowerCase());
						uci.set("wireless", section1, "wds", "1");
					}
				}
				else if(currentModes.match(/\+/))
				{
					section2 = 'cfg3';
					uci.set("wireless", "cfg3", "", "wifi-iface");
					uci.set("wireless", "cfg3", "device", firstWirelessDevice);
					preCommands = preCommands + "uci set wireless.cfg3='wifi-iface' \n"
				}
			}
			else if(currentModes != 'disabled')
			{
				section2 = 'cfg2';
				uci.set("wireless", "cfg2", "", "wifi-iface");
				uci.set("wireless", "cfg2", "device", firstWirelessDevice);
				preCommands = preCommands + "uci set wireless.cfg2='wifi-iface' \n"
			}
			preCommands = preCommands + "uci commit \n";

		
			if(section2 != '')
			{
				mode2=currentModes.replace(/\+?ap\+?/, '');
				if(mode2 != "wds")
				{
					uci.set('wireless', section2, 'mode', mode2);
					if(!getSelectedValue("wan_protocol").match(/wireless/))
					{
						uci.set('wireless', section2, 'network', 'lan');
					}
					else
					{
						uci.set('wireless', section2, 'network', 'wan');
					}
				}
			}



			//set mac filter variables
			macFilterEnabled = getSelectedValue("mac_filter_enabled") == "enabled";
			var macTable = document.getElementById('mac_table_container').firstChild;
			var macList = getTableDataArray(macTable, true, false);
			var policy = getSelectedValue("mac_filter_policy");			
			var macListStr = macList.join(" ");
			if(wirelessDriver == "broadcom")
			{
				if( (!macFilterEnabled) || macListStr == '')
				{
					uci.remove("wireless", firstWirelessDevice, policyOption);
					uci.remove("wireless", firstWirelessDevice, "maclist");
				}
				else
				{
					uci.set("wireless", firstWirelessDevice, policyOption, policy);
					uci.set("wireless", firstWirelessDevice, "maclist", macListStr);
				}
			}
			else if(wirelessDriver == "atheros")
			{
				for(wsecIndex=0; wsecIndex < allWirelessSections.length; wsecIndex++)
				{
					var sectionType = uci.get("wireless", allWirelessSections[wsecIndex], "");
					if( (!macFilterEnabled) || macListStr == '' || sectionType != "wifi-iface")
					{
						uci.remove("wireless", allWirelessSections[wsecIndex], policyOption);
						uci.remove("wireless", allWirelessSections[wsecIndex], "maclist");
					}
					else
					{
						uci.set("wireless", allWirelessSections[wsecIndex], policyOption, policy);
						uci.set("wireless", allWirelessSections[wsecIndex], "maclist", macListStr);
					}
				}	
			}


			//if current dhcp range is not in new subnet, or current dhcp range contains new router ip adjust it
			var dhcpSection = getDhcpSection(uciOriginal);
			var newMask = document.getElementById("lan_mask").value;
			var newIp = document.getElementById("lan_ip").value;
			var routerIpEnd = parseInt( (newIp.split("."))[3] );
			var oldStart = parseInt( uciOriginal.get("dhcp", dhcpSection, "start") );
			var oldEnd = oldStart + parseInt( uciOriginal.get("dhcp", dhcpSection, "limit") ) - 1;
			if(!rangeInSubnet(newMask, newIp, oldStart, oldEnd) || (routerIpEnd >= oldStart && routerIpEnd <= oldEnd))
			{
				//compute new dhcp range, note this cannot include router's static ip
				var newRange =getSubnetRange(newMask, newIp);
				var newStart;
				var newEnd;
				if(routerIpEnd - newRange[0] > newRange[1] - routerIpEnd)
				{
					newStart = newRange[0];
					newEnd = routerIpEnd-1;
				}
				else
				{
					newStart = routerIpEnd+1;
					newEnd = newRange[1];
				}
				uci.set("dhcp", dhcpSection, "start", newStart);
				uci.set("dhcp", dhcpSection, "limit", (newEnd+1-newStart) );
			}




			ppoeReconnectIds = ['wan_pppoe_reconnect_pings', 'wan_pppoe_interval'];
			inputIds = ['wan_protocol', 'wan_pppoe_user', 'wan_pppoe_pass', 'wan_pppoe_max_idle', ppoeReconnectIds, 'wan_static_ip', 'wan_static_mask', 'wan_static_gateway', 'wan_mac', 'wan_mtu', 'lan_ip', 'lan_mask', 'lan_gateway', 'wifi_ssid1', 'wifi_hidden', 'wifi_isolate', 'wifi_encryption1', 'wifi_pass1', 'wifi_wep1' , 'wifi_server1', 'wifi_port1', 'wifi_pass2', 'wifi_wep2'];
			
			options = ['proto', 'username', 'password', 'demand', 'keepalive', 'ipaddr', 'netmask', 'gateway', 'macaddr', 'mtu', 'ipaddr', 'netmask', 'gateway', 'ssid', 'hidden', 'isolate', 'encryption', 'key', 'key', 'server', 'port', 'key', 'key'];
		
			var sv=  setVariableFromValue;
			var svm= setVariableFromModifiedValue;
			var svcat= setVariableFromConcatenation;
			var svcond= setVariableConditionally;
			setFunctions = [sv,sv,sv,svm,svcat,sv,sv,sv,svcond,svcond,sv,sv,sv,sv,svcond,svcond,sv,sv,sv,sv,sv,sv,sv];
			
			var f=false;
			var t=true;
			var minutesToSeconds = function(value){return value*60;};
			var lowerCase = function(value) { return value.toLowerCase(); }
			var ifCustomMac = function(value){ return (document.getElementById('wan_use_mac').checked == true); };
			var ifCustomMtu = function(value){ return (document.getElementById('wan_use_mtu').checked == true &&  document.getElementById('wan_mtu').value != 1500);};
			var ifHiddenChecked =  function(value) { return getSelectedValue('wifi_hidden') == "disabled" ? 1 : 0;}; //the label is for "broadcast", so disabled means it is hidden
			var ifIsolateChecked = function(value) { return getSelectedValue('wifi_isolate') == "enabled" ? 1 : 0;};
			var demandParams = [f,minutesToSeconds];
			var macParams = [ifCustomMac,f,  document.getElementById('wan_mac').value.toLowerCase()];
			var mtuParams = [ifCustomMtu,t,''];
			var hiddenParams = [ifHiddenChecked,f,'1'];
			var isolateParams = [ifIsolateChecked,f,'1'];
		
			additionalParams = [f,f,f, demandParams,f,f,f,f,macParams,mtuParams,f,f,f,f,hiddenParams,isolateParams,f,f,f,f,f,f,f];

		
		
			pppoeReconnectVisibilityIds = ['wan_pppoe_reconnect_pings_container', 'wan_pppoe_interval_container'];
			multipleVisibilityIds= [pppoeReconnectVisibilityIds];
			wirelessSections=[section1, section1, section1, section1, section1, section1, section1, section1, section2, section2 ];
			visibilityIds = [];
			pkgs = [];
			sections = [];
			var idIndex;
			for (idIndex=0; idIndex < inputIds.length; idIndex++)
			{
				if(isArray(inputIds[idIndex]))
				{
					visibilityIds.push(multipleVisibilityIds.shift());
				}
				else
				{
					visibilityIds.push(inputIds[idIndex]+ "_container");
				}
			
			
				if(idIndex < 10)
				{
					pkgs.push('network');
					sections.push('wan');
					uci.remove('network', 'wan', options[idIndex]);
				}
				else if(idIndex < 13)
				{
					pkgs.push('network');
					sections.push('lan')
					uci.remove('network', 'lan', options[idIndex]);
				}
				else
				{
					pkgs.push('wireless');
					sections.push(wirelessSections.shift());
				}
			}
			setVariables(inputIds, visibilityIds, uci, pkgs, sections, options, setFunctions, additionalParams);
			

			//set wifi channel, ssid2, encryption2
			//this is a bit complex (and we have to do it here) because of options introduced by wireless scanning
			if(getSelectedValue("wifi_mode") != 'disabled')
			{
				var ssid2 ="";
				var enc2 = "";
				if(document.getElementById("wifi_ssid2_container").style.display != "none")
				{
					ssid2 = document.getElementById("wifi_ssid2").value;
					enc2 = getSelectedValue("wifi_encryption2");
				}
				else if(document.getElementById("wifi_custom_ssid2_container").style.display != "none")
				{
					ssid2 = document.getElementById("wifi_custom_ssid2").value;
					enc2 = getSelectedValue("wifi_encryption2");
				}
				else if(document.getElementById("wifi_list_ssid2_container").style.display != "none")
				{
					ssid2 = scannedSsids[0][ parseInt(getSelectedValue("wifi_list_ssid2")) ];
					enc2  = scannedSsids[1][ parseInt(getSelectedValue("wifi_list_ssid2")) ];
				}
				if(ssid2 != "")
				{
					uci.set("wireless", section2, "ssid", ssid2);
					uci.set("wireless", section2, "encryption", enc2);
				}

				var chan = document.getElementById("wifi_fixed_channel2").style.display != "none" ?  document.getElementById("wifi_fixed_channel2").firstChild.data : getSelectedValue("wifi_channel2");
				uci.set("wireless", firstWirelessDevice, "channel", chan);
			}
		

			//if wan protocol is 'none' do not set it
			if(getSelectedValue('wan_protocol') == 'none')
			{
				uci.removeSection("network", "wan");
			}
			else
			{
				uci.set("network", "wan", "proto", getSelectedValue('wan_protocol').replace(/_.*$/g, ""));
			}
			if(uci.get('network', 'lan', 'proto') === '')
			{
				uci.set('network', 'lan', 'proto', 'static');
			}
			

			//preserve wan mac definition even if wan is disabled if this is a bcm94704
			if(isBcm94704 && (uci.get("network", "wan", "type") != "bridge"))
			{
				if(uci.get("network", "wan", "macaddr") == "")
				{
					uci.set("network", "wan", "macaddr", defaultWanMac);
				}
			}
		

			//In X-Wrt option defaultroute = 1 is set for wan section when pppoe is active
			//I have no idea how this solves the issue, but people report this makes pppoe work
			//So, let's try it...
			if(getSelectedValue("wan_protocol", document) == "pppoe")
			{
				uci.set("network", "wan", "defaultroute", "1");
			}
			else
			{
				uci.remove("network", "wan", "defaultroute");
			}




			
			
			var bridgeCommandList = [];
			bridgeCommandList.push("/etc/init.d/dnsmasq enable");
			bridgeCommandList.push("uci set gargoyle.connection.dhcp=200");
			bridgeCommandList.push("uci set gargoyle.firewall.portforwarding=100");
			bridgeCommandList.push("uci set gargoyle.firewall.restriction=125");
			bridgeCommandList.push("uci set gargoyle.firewall.quotas=175");
			bridgeCommandList.push("uci set qos_gargoyle.global.network=wan");
			bridgeCommandList.push("uci commit");
			bridgeEnabledCommands = "\n" + bridgeCommandList.join("\n") + "\n";
		}
		else
		{
			if( document.getElementById("bridge_wan_port_to_lan_container").style.display != "none" && getSelectedValue('bridge_wan_port_to_lan') == "bridge" )
			{
				uci.set('network', 'lan', 'ifname', defaultLanIf + " " + defaultWanIf);
			}
			else
			{
				uci.set('network', 'lan', 'ifname', defaultLanIf);
			}

			currentLanIp = document.getElementById("bridge_ip").value;
			//compute configuration  for bridge
			preCommands = preCommands + "\nuci del network.wan\nuci commit\n";
			uci.removeSection("network", "wan");
			uciCompare.removeSection("network", "wan");

			uci.set("network", "lan", "ipaddr",  document.getElementById("bridge_ip").value);
			uci.set("network", "lan", "netmask", document.getElementById("bridge_mask").value);
			uci.set("network", "lan", "gateway", document.getElementById("bridge_gateway").value);
			uci.set("network", "lan", "dns",     document.getElementById("bridge_gateway").value);
			uci.set("wireless", firstWirelessDevice, "channel", getSelectedValue("bridge_channel"));
		
			var ssid ="";
			var encryption = "";
			if(document.getElementById("bridge_ssid_container").style.display != "none")
			{
				ssid = document.getElementById("bridge_ssid").value;
				encryption = getSelectedValue("bridge_encryption");
			}
			else if(document.getElementById("bridge_custom_ssid_container").style.display != "none")
			{
				ssid = document.getElementById("bridge_custom_ssid").value;
				encryption = getSelectedValue("bridge_encryption");
			}
			else if(document.getElementById("bridge_list_ssid_container").style.display != "none")
			{
				ssid = scannedSsids[0][ parseInt(getSelectedValue("bridge_list_ssid")) ];
				encryption  = scannedSsids[1][ parseInt(getSelectedValue("bridge_list_ssid")) ];
			}
			var key = encryption == "none" ? "" : ( encryption == "wep" ? document.getElementById("bridge_wep").value : document.getElementById("bridge_pass").value );
			var chan = document.getElementById("bridge_fixed_channel").style.display != "none" ?  document.getElementById("bridge_fixed_channel").firstChild.data : getSelectedValue("bridge_channel");
			uci.set("wireless", firstWirelessDevice, "channel", chan);

			if( getSelectedValue("bridge_mode") == "client_bridge")
			{
				//client bridge
				uci.set("wireless", "cfg2", "", "wifi-iface");
				uci.set("wireless", "cfg2", "device", firstWirelessDevice);
				uci.set("wireless", "cfg2", "network", "lan");
				uci.set("wireless", "cfg2", "mode", "sta");
				uci.set("wireless", "cfg2", "client_bridge", "1");
				uci.set("wireless", "cfg2", "ssid", ssid);
				uci.set("wireless", "cfg2", "encryption", encryption);
				if(encryption != "none") { uci.set("wireless", "cfg2", "key", key); }
				preCommands = preCommands + "\nuci set wireless.cfg2=wifi-iface\n";
			       	
				if(getSelectedValue("bridge_repeater") == "enabled")
				{
					uci.set("wireless", "cfg3", "", "wifi-iface");
					uci.set("wireless", "cfg3", "device", firstWirelessDevice);
					uci.set("wireless", "cfg3", "network", "lan");
					uci.set("wireless", "cfg3", "mode", "ap");
					uci.set("wireless", "cfg3", "ssid", ssid);
					uci.set("wireless", "cfg3", "encryption", encryption);
					if(encryption != "none") { uci.set("wireless", "cfg3", "key", key); }
					preCommands = preCommands + "\nuci set wireless.cfg3=wifi-iface\n";
				}
			}
			else
			{
				//wds
			
				//get bssids	
				var wdsData = getTableDataArray(document.getElementById('bridge_wds_mac_table_container').firstChild);
				var wdsList = [];
				var wIndex=0;
				for(wIndex=0; wIndex< wdsData.length; wIndex++)
				{
					wdsList.push( wdsData[wIndex][0].toLowerCase() );
				}	
				

				if(wirelessDriver == "broadcom")
				{
					uci.set("wireless", "cfg2", "", "wifi-iface");
					uci.set("wireless", "cfg2", "device", firstWirelessDevice);
					uci.set("wireless", "cfg2", "network", "lan");
					uci.set("wireless", "cfg2", "mode", "ap");
					uci.set("wireless", "cfg2", "ssid", ssid);
					uci.set("wireless", "cfg2", "encryption", encryption);
					if(encryption != "none") { uci.set("wireless", "cfg2", "key", key); }
					preCommands = preCommands + "\nuci set wireless.cfg2=wifi-iface\n";
				
					for(wIndex=0; wIndex < wdsList.length; wIndex++)
					{
						var sectionIndex=wIndex + 3;
						var section = "cfg" + sectionIndex;
						uci.set("wireless", section, "", "wifi-iface");
						uci.set("wireless", section, "device", firstWirelessDevice);
						uci.set("wireless", section, "network", "lan");
						uci.set("wireless", section, "mode", "wds");
						uci.set("wireless", section, "ssid", ssid);
						uci.set("wireless", section, "bssid", wdsList[wIndex].toLowerCase());
						uci.set("wireless", section, "encryption", encryption);
						if(encryption != "none") { uci.set("wireless", section, "key", key); }
						preCommands = preCommands + "\nuci set wireless." + section + "=wifi-iface\n";
					}
				
				}
				else //atheros driver
				{
					uci.set("wireless", "cfg2", "", "wifi-iface");
					uci.set("wireless", "cfg2", "device", firstWirelessDevice);
					uci.set("wireless", "cfg2", "network", "lan");
					uci.set("wireless", "cfg2", "mode", "ap");
					uci.set("wireless", "cfg2", "wds", "1");
					uci.set("wireless", "cfg2", "ssid", ssid);
					uci.set("wireless", "cfg2", "bssid", wdsList.join(" ").toLowerCase() );
					uci.set("wireless", "cfg2", "encryption", encryption);
					if(encryption != "none") { uci.set("wireless", "cfg2", "key", key); }
					preCommands = preCommands + "\nuci set wireless.cfg2=wifi-iface\n";


					uci.set("wireless", "cfg3", "", "wifi-iface");
					uci.set("wireless", "cfg3", "device", firstWirelessDevice);
					uci.set("wireless", "cfg3", "network", "lan");
					uci.set("wireless", "cfg3", "mode", "sta");
					uci.set("wireless", "cfg3", "wds", "1");
					uci.set("wireless", "cfg3", "ssid", ssid);
					uci.set("wireless", "cfg3", "bssid", wdsList.join(" ").toLowerCase() );
					uci.set("wireless", "cfg3", "encryption", encryption);
					if(encryption != "none") { uci.set("wireless", "cfg3", "key", key); }
					preCommands = preCommands + "\nuci set wireless.cfg3=wifi-iface\n";

				}

			}
			preCommands = preCommands + "\nuci commit\n";


			var bridgeCommandList = [];
			bridgeCommandList.push("/etc/init.d/dnsmasq disable");
			bridgeCommandList.push("/etc/init.d/miniupnpd disable");
			bridgeCommandList.push("uci del gargoyle.connection.dhcp");
			bridgeCommandList.push("uci del gargoyle.firewall.portforwarding");
			bridgeCommandList.push("uci del gargoyle.firewall.restriction");
			bridgeCommandList.push("uci del gargoyle.firewall.quotas");
			bridgeCommandList.push("uci del gargoyle.firewall.portforwarding");
			bridgeCommandList.push("uci set qos_gargoyle.global.network=lan");

			bridgeCommandList.push("uci commit");
			bridgeEnabledCommands = "\n" + bridgeCommandList.join("\n") + "\n";


		}


		//set lan dns from table
		//this code is the same for both router & bridge
		//we set from lan table, but we keep bridge & lan dns tables synchronized
		//so they should be identical
		var lanGateway = uci.get("network", "lan", "gateway");
		lanGateway = lanGateway == "" ? uci.get("network", "lan", "ipaddr") : lanGateway;
		var dns = lanGateway;
		if(document.getElementById("lan_use_dns").checked)
		{
			var dnsData = getTableDataArray(document.getElementById("lan_dns_table_container").firstChild);
			var dnsList = [];
			var dnsIndex=0;
			for(dnsIndex=0; dnsIndex < dnsData.length; dnsIndex++) { dnsList.push(dnsData[dnsIndex][0]); }
			dns = dnsList.length > 0 ? dnsList.join(" ") : dns;
		}
		uci.set("network", "lan", "dns", dns);


		var oldLanIp = uciOriginal.get("network", "lan", "ipaddr");
		if(oldLanIp != currentLanIp && oldLanIp != "" && currentLanIp != "")
		{
			adjustIpCommands = "\nsh " + gargoyleBinRoot + "/utility/update_router_ip.sh " + oldLanIp + "  " + currentLanIp;
		}

		var commands = uci.getScriptCommands(uciCompare);
		var restartNetworkCommand = wirelessDriver== "broadcom" ? "\nsh " + gargoyleBinRoot + "/utility/restart_network.sh ;\n"  : "\nsh " + gargoyleBinRoot + "/utility/reboot.sh ;\n";
		commands = preCommands + commands + adjustIpCommands + bridgeEnabledCommands + restartNetworkCommand;

		
		//document.getElementById("output").value = commands;
		var param = getParameterDefinition("commands", commands);
		
		var stateChangeFunction = function(req)
		{
			if(req.readyState == 4)
			{
				//alert(req.responseText);
				if(wirelessDriver == "broadcom" && oldLanIp == currentLanIp)
				{
					uciOriginal = uci.clone();
					resetData();
					setControlsEnabled(true);
				}
			}
		}
		runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);


		//if we're rebooting, this tests whether reboot is done, otherwise
		//it tests if router is up at new ip
		if(wirelessDriver != "broadcom" || oldLanIp != currentLanIp)
		{
			currentProtocol = location.href.match(/^https:/) ? "https" : "http";
			testLocation = currentProtocol + "://" + currentLanIp + ":" + window.location.port + "/utility/reboot_test.sh";
			testReboot = function()
			{
				toggleReload = true;
				setTimeout( "testReboot()", 5*1000);  //try again after 5 seconds
				document.getElementById("reboot_test").src = testLocation;
			}
			setTimeout( "testReboot()", 25*1000);  //start testing after 25 seconds
			setTimeout( "reloadPage()", 240*1000); //after 4 minutes, try to reload anyway
		}
	}
}


function reloadPage()
{
	if(toggleReload)
	{
		//IE calls onload even when page isn't loaded -- it just times out and calls it anyway
		//We can test if it's loaded for real by looking at the (IE only) readyState property
		//For Browsers NOT designed by dysfunctional cretins whose mothers were a pack of sewer-dwelling, shit-eating rodents,
		//well, for THOSE browsers, readyState (and therefore reloadState) should be null 
		var reloadState = document.getElementById("reboot_test").readyState;
		if( typeof(reloadState) == "undefined" || reloadState == null || reloadState == "complete")
		{
			toggleReload=false;
			document.getElementById("reboot_test").src = "";
			currentProtocol = location.href.match(/^https:/) ? "https" : "http";
			window.location = currentProtocol + "://" + currentLanIp + ":" + window.location.port + window.location.pathname;
		}
	}
}



function generateWepKey(length)
{
	var keyIndex = 0;
	var key = "";
	var hex = ['0','1','2','3','4','5','6','7','8','9','A','B','C','D','E','F'];
	while(keyIndex < length)
	{
		next=hex[Math.floor(Math.random()*16)];
		key=key+next;
		keyIndex++;
	}
	return key;
}

function setToWepKey(id, length)
{
	document.getElementById(id).value = generateWepKey(length);
	proofreadWep(document.getElementById(id));
}


function proofreadAll()
{
	var vlr1 = function(text){return validateLengthRange(text,1,999);};
	var vlr8 = function(text){return validateLengthRange(text,8,999);};
	var vip = validateIP;
	var vnm = validateNetMask;
	var vm = validateMac;
	var vn = validateNumeric;
	var vw = validateWep;

	var testWds = function(tableContainerId, selectId, wdsValue)
	{
		var error = null;
		if( getSelectedValue(selectId) == wdsValue )
		{
			var wdsData = getTableDataArray(document.getElementById(tableContainerId).firstChild);
			error = wdsData.length > 0 ? null : "You must specify at least one MAC address in order to enable WDS";
		}
		return error;
	}


	var errors = [];
	if(document.getElementById("global_router").checked)
	{
		var inputIds = ['wan_pppoe_user', 'wan_pppoe_pass', 'wan_pppoe_max_idle', 'wan_pppoe_reconnect_pings', 'wan_pppoe_interval', 'wan_static_ip', 'wan_static_mask', 'wan_static_gateway', 'wan_mac', 'wan_mtu', 'lan_ip', 'lan_mask', 'lan_gateway', 'wifi_ssid1', 'wifi_pass1', 'wifi_wep1', 'wifi_server1', 'wifi_port1', 'wifi_ssid2', 'wifi_pass2', 'wifi_wep2'];
	
		var functions= [vlr1, vlr1, vn, vn, vn, vip, vnm, vip, vm, vn, vip, vnm, vip, vlr1, vlr8, vw, vip, vn, vlr1, vlr8, vw];
	
		var returnCodes= new Array();
		var visibilityIds = new Array();
		for (idIndex in inputIds)
		{
			returnCodes.push(0);
			visibilityIds.push( inputIds[idIndex] + "_container" );
		}

	
		var labelIds = new Array();
		for (idIndex in inputIds)
		{
			labelIds.push( inputIds[idIndex] + "_label");
		}
		errors= proofreadFields(inputIds, labelIds, functions, returnCodes, visibilityIds);
		
		var wdsError = testWds("wifi_wds_mac_table_container", "wifi_mode", "ap+wds");
		if(wdsError != null){ errors.push(wdsError); }
	}
	else
	{
		var inputIds = ['bridge_ip', 'bridge_mask', 'bridge_gateway', 'bridge_ssid', 'bridge_pass', 'bridge_wep'];
		var functions = [vip, vnm, vip, vlr1,vlr8,vw];
		var returnCodes=[];
		var visibilityIds=[];
		var labelIds=[];

		var idIndex=0;
		for(idIndex=0; idIndex < inputIds.length; idIndex++)
		{
			returnCodes.push(0);
			visibilityIds.push( inputIds[idIndex] + "_container" );
			labelIds.push( inputIds[idIndex] + "_label" );
		}
		errors= proofreadFields(inputIds, labelIds, functions, returnCodes, visibilityIds);
		
		var wdsError = testWds("bridge_wds_mac_table_container", "bridge_mode", "wds");
		if(wdsError != null){ errors.push(wdsError); }
	}
	return errors;
}


function setGlobalVisibility()
{
	//deal with possibility of wireless routed WAN 
	globalIds=['wan_via_single_port_container', 'wan_port_to_lan_container'];
	wirelessWanVisibility       = defaultWanIf != '' ? [0,1] : [0,0];
	defaultVisibility           = defaultWanIf != '' ? [0,0] : [1,0];


	selectedVisibility=defaultVisibility;
	if( getSelectedValue("wan_protocol").match(/wireless/) )
	{
		selectedVisibility=wirelessWanVisibility;

		currentMode=getSelectedValue('wifi_mode');
		setAllowableSelections('wifi_mode', ['sta', 'ap+sta'], ['Client', 'Client+AP']);
	       	if(currentMode == 'ap' || currentMode == 'ap+wds')
		{
			setSelectedValue("wifi_mode", 'ap+sta');
		}
		else if(currentMode == 'disabled')
		{
			setSelectedValue("wifi_mode", 'sta');
		}
	}
	else
	{
		currentMode=getSelectedValue('wifi_mode');
		setAllowableSelections('wifi_mode', ['ap', 'ap+wds', 'adhoc', 'disabled'], ['Access Point (AP)', 'AP+WDS', 'Ad Hoc', 'Disabled']);
		if(currentMode == 'ap+sta' || currentMode == 'sta')
		{
			setSelectedValue('wifi_mode', 'ap');
		}
		else
		{
			setSelectedValue('wifi_mode', currentMode);
		}
	}


	if(defaultWanIf == '' && (!(getSelectedValue('wan_via_single_port')=="wan" && document.getElementById('wan_via_single_port_container').style.display != "none" )))
	{
		if(!getSelectedValue("wan_protocol").match(/wireless/) )
		{
			setSelectedValue("wan_protocol", 'none' );
		}
		setAllowableSelections('wan_protocol', ['dhcp_wireless', 'static_wireless', 'none'], ['DHCP (Wireless)', 'Static (Wireless)', 'Disabled']);
	}
	else
	{
		setAllowableSelections('wan_protocol', ['dhcp_wired', 'pppoe_wired', 'static_wired', 'dhcp_wireless', 'static_wireless', 'none'], ['DHCP (Wired)', 'PPPoE (Wired)', 'Static IP (Wired)', 'DHCP (Wireless)', 'Static IP (Wireless)','Disabled']);
	}


	setVisibility(globalIds, selectedVisibility);
	
	
	setWanVisibility();
	setWifiVisibility();
}




function setWanVisibility()
{
	wanIds=['wan_pppoe_user_container', 'wan_pppoe_pass_container', 'wan_pppoe_reconnect_mode_container', 'wan_pppoe_max_idle_container', 'wan_pppoe_reconnect_pings_container', 'wan_pppoe_interval_container', 'wan_static_ip_container', 'wan_static_mask_container', 'wan_static_gateway_container', 'wan_mac_container', 'wan_mtu_container', 'lan_gateway_container'];

	notWifi= getSelectedValue('wan_protocol').match(/wireless/) ? 0 : 1;

	dhcpVisability     = [0,0,0,0,0,0,  0,0,0,  notWifi,notWifi, 0];
	pppoeVisability    = [1,1,1,1,1,1,  0,0,0,  notWifi,notWifi, 0];
	staticVisability   = [0,0,0,0,0,0,  1,1,1,  notWifi,notWifi, 0];
	disabledVisability = [0,0,0,0,0,0,  0,0,0,  0,0,             1];
	
	wanVisibilities= new Array();
	wanVisibilities['dhcp'] = dhcpVisability;
	wanVisibilities['pppoe'] = pppoeVisability;
	wanVisibilities['static'] = staticVisability;
	wanVisibilities['none'] = disabledVisability;
	
	selectedVisibility= wanVisibilities[ getSelectedValue("wan_protocol").replace(/_.*$/g, "") ];
	
	selectedVisibility[3] = selectedVisibility[3] ==1 && document.getElementById('wan_pppoe_reconnect_mode').value == 'demand' ? 1 : 0;
	selectedVisibility[4] = selectedVisibility[4] ==1 && document.getElementById('wan_pppoe_reconnect_mode').value == 'keepalive' ? 1 : 0;
	selectedVisibility[5] = selectedVisibility[5] ==1 && document.getElementById('wan_pppoe_reconnect_mode').value == 'keepalive' ? 1 : 0;

	setVisibility(wanIds, selectedVisibility);
}

function setWifiVisibility()
{
	var wifiMode=getSelectedValue("wifi_mode");
	if(wifiMode == "ap+wds")
	{
		setAllowableSelections('wifi_encryption1', ['none', 'psk2', 'psk', 'wep'], ['None', 'WPA2 PSK', 'WPA PSK', 'WEP']);
	}
	else
	{
		setAllowableSelections('wifi_encryption1', ['none', 'psk2', 'psk', 'wep', 'wpa', 'wpa2'], ['None', 'WPA2 PSK', 'WPA PSK', 'WEP', 'WPA RADIUS', 'WPA2 RADIUS']);
	}

	if(wifiMode == 'adhoc')
	{
		setAllowableSelections('wifi_encryption2', ['none', 'wep'], ['None', 'WEP']);
		document.getElementById("wifi_ssid2_label").firstChild.data = "SSID:";
	}
	else
	{
		document.getElementById("wifi_ssid2_label").firstChild.data = "SSID to Join:";
		setAllowableSelections('wifi_encryption2', ['none', 'psk2', 'psk', 'wep'], ['None', 'WPA2 PSK', 'WPA PSK', 'WEP']);
	}
	
	

	var wifiIds=[	'internal_divider1', 
	    		'mac_enabled_container', 
			'mac_filter_container', 
			
			'wifi_ssid1_container',
			'wifi_channel1_container',
			'wifi_fixed_channel1_container',
			'wifi_hidden_container', 
			'wifi_isolate_container', 
			'wifi_encryption1_container', 
			'wifi_pass1_container', 
			'wifi_wep1_container', 
			'wifi_server1_container', 
			'wifi_port1_container', 
			'wifi_mac_container', 
			'wifi_wds_container', 
			
			'internal_divider2', 
			"wifi_list_ssid2_container", 
			"wifi_custom_ssid2_container", 
			'wifi_ssid2_container', 
			'wifi_scan_button', 
			'wifi_channel2_container', 
			'wifi_fixed_channel2_container',
			'wifi_encryption2_container',
			'wifi_fixed_encryption2_container',
			'wifi_pass2_container', 
			'wifi_wep2_container'
			];

	var mf = getSelectedValue("mac_filter_enabled") == "enabled" ? 1 : 0;
	var e1 = document.getElementById('wifi_encryption1').value;
	var p1 = (e1 != 'none' && e1 != 'wep') ? 1 : 0;
	var w1 = (e1 == 'wep') ? 1 : 0;
	var r1 = (e1 == 'wpa' || e1 == 'wpa2') ? 1 : 0;
	var e2 = document.getElementById('wifi_fixed_encryption2').style.display != 'none' ? document.getElementById('wifi_fixed_encryption2').firstChild.data : getSelectedValue('wifi_encryption2');
	var p2 = e2.match(/psk/) || e2.match(/WPA/) ? 1 : 0;
	var w2 = e2.match(/wep/) || e2.match(/WEP/) ? 1 : 0;

	var wifiVisibilities = new Array();
	wifiVisibilities['ap']       = [1,1,mf,   1,1,0,1,1,1,p1,w1,r1,r1, 0,0,  0,0,0,0,0,0,0,0,0,0,0 ];
	wifiVisibilities['ap+wds']   = [1,1,mf,   1,1,0,1,1,1,p1,w1,r1,r1, 1,1,  0,0,0,0,0,0,0,0,0,0,0 ];
	wifiVisibilities['sta']      = [1,1,mf,   0,0,0,0,0,0,0,0,0,0,     0,0,  0,0,0,1,1,1,0,1,0,p2,w2];
	wifiVisibilities['ap+sta']   = [1,1,mf,   1,1,0,1,1,1,p1,w1,r1,r1, 0,0,  1,0,0,1,1,1,0,1,0,p2,w2];
	wifiVisibilities['adhoc']    = [1,1,mf,   0,0,0,0,0,0,0,0,0,0,     0,0,  0,0,0,1,0,1,0,1,0,p2,w2];
	wifiVisibilities['disabled'] = [0,0,0,    0,0,0,0,0,0,0,0,0,0,     0,0,  0,0,0,0,0,0,0,0,0,0,0 ];
	
	var wifiVisibility = wifiVisibilities[ wifiMode ];
	setVisibility(wifiIds, wifiVisibility);

	if(wifiMode.match(/sta/))
	{
		setSsidVisibility("wifi_list_ssid2");
	}
}

function setBridgeVisibility()
{

	showIds = document.getElementById("global_router").checked ? ["wan_fieldset", "lan_fieldset", "wifi_fieldset"] : ["bridge_fieldset"];
	hideIds = document.getElementById("global_router").checked ? ["bridge_fieldset"] : ["wan_fieldset", "lan_fieldset", "wifi_fieldset"];
	var allIds = [hideIds, showIds];
	var statIndex;
	for(statIndex=0; statIndex < 2; statIndex++)
	{
		var ids =allIds[statIndex];
		var idIndex;
		for(idIndex=0; idIndex < ids.length; idIndex++)
		{
			document.getElementById(ids[idIndex]).style.display = statIndex==0 ? "none" : "block";
		}
	}

	if(defaultWanIf == '')
	{
		document.getElementById("bridge_wan_port_to_lan_container").style.display = "none";
	}
	else
	{
		document.getElementById("bridge_wan_port_to_lan_container").style.display = "block";
	}

	if(document.getElementById("global_bridge").checked)
	{
		var brenc = document.getElementById("bridge_fixed_encryption_container").style.display == "none" ? getSelectedValue("bridge_encryption") : document.getElementById("bridge_fixed_encryption").firstChild.data;
		document.getElementById("bridge_pass_container").style.display = brenc.match(/psk/) || brenc.match(/WPA/) ? "block" : "none";
		document.getElementById("bridge_wep_container").style.display  = brenc.match(/wep/) || brenc.match(/WEP/) ? "block" : "none";
		//alert("fixed_display=" + document.getElementById("bridge_fixed_encryption_container").style.display + "brenc = " + brenc);

		document.getElementById("bridge_repeater_container").style.display = getSelectedValue("bridge_mode") == "client_bridge" ? "block" : "none";
		document.getElementById("bridge_wifi_mac_container").style.display = getSelectedValue("bridge_mode") == "wds" ? "block" : "none";
		document.getElementById("bridge_wds_container").style.display = getSelectedValue("bridge_mode") == "wds" ? "block" : "none";
		document.getElementById("bridge_fixed_encryption_container").style.display="none";
		document.getElementById("bridge_fixed_channel_container").style.display="none";

		setSsidVisibility("bridge_list_ssid");
	}
	setGlobalVisibility();
}

function resetData()
{
	if(wirelessDriver == "broadcom")
	{
		removeOptionFromSelectElement("bridge_channel", "auto", document);
		removeOptionFromSelectElement("wifi_channel1", "auto", document);
		removeOptionFromSelectElement("wifi_channel2", "auto", document);
	}

	var macElements = [ "bridge_wifi_mac", "wifi_mac" ];
	var meIndex;
	for(meIndex = 0; meIndex < macElements.length; meIndex++)
	{
		var me = document.getElementById(macElements[meIndex]);
		if(me.firstChild != null)
		{
			me.removeChild(me.firstChild);
		}
		me.appendChild( document.createTextNode(currentWirelessMac) );
	}


	var confIsBridge = isBridge(uciOriginal);
	var confIsRouter = !confIsBridge;
	document.getElementById("global_router").checked = confIsRouter;
	document.getElementById("global_bridge").checked = confIsBridge;

	//set bridge variables
	document.getElementById("bridge_ip").value      = uciOriginal.get("network", "lan", "ipaddr");
	document.getElementById("bridge_mask").value    = uciOriginal.get("network", "lan", "netmask");
	document.getElementById("bridge_gateway").value = uciOriginal.get("network", "lan", "gateway");
	var bridgeWdsTableData = [];
	if(confIsBridge)
	{
		var bridgeSection = getBridgeSection(uciOriginal);
		var mode = uciOriginal.get("wireless", bridgeSection, "client_bridge") == "1" ? "client_bridge" : "wds";
		setSelectedValue("bridge_mode", mode);
		document.getElementById("bridge_ssid").value = uciOriginal.get("wireless", bridgeSection, "ssid");
	
		var repeaterEnabled = "disabled";
		var testSections = getAllSectionsOfType("wireless", "wifi-iface");
		while(testSections.length > 0 && repeaterEnabled == "disabled") { repeaterEnabled = uciOriginal.get("wireless", testSections.shift(), "mode") == "ap" ? "enabled" : "disabled"; }
		setSelectedValue("bridge_repeater", repeaterEnabled);


		var encryption = uciOriginal.get("wireless", bridgeSection, "encryption");
		encryption = encryption == "" ? "none" : encryption;
		setSelectedValue("bridge_encryption", encryption);
		document.getElementById("bridge_wep").value = encryption == "wep" ? uciOriginal.get("wireless", bridgeSection, "key") : "";
		document.getElementById("bridge_pass").value = encryption != "wep" && encryption != "none" ? uciOriginal.get("wireless", bridgeSection, "key") : "";



		if(mode == "wds")
		{
			if(wirelessDriver == "broadcom")
			{
				var ifaceSections = uciOriginal.getAllSectionsOfType("wireless", "wifi-iface");
				var ifIndex;
				for(ifIndex=0; ifIndex< ifaceSections.length; ifIndex++)
				{
					if( uciOriginal.get("wireless", ifaceSections[ifIndex], "mode") == "wds")
					{
						var bssid = uciOriginal.get("wireless", ifaceSections[ifIndex], "bssid");
						bridgeWdsTableData.push( [bssid.toUpperCase()] );
					}
				}
			}
			else
			{
				var bssids = uciOriginal.get("wireless", bridgeSection, "bssid").split(/[\t ]+/);
				var bIndex;
				for(bIndex = 0; bIndex < bssids.length; bIndex++)
				{
					bridgeWdsTableData.push([ bssids[bIndex].toUpperCase() ]);
				}
			}

		}
	}
	else
	{
		
		setSelectedValue("bridge_mode", "client_bridge");
		setSelectedValue("bridge_repeater", "enabled");
		document.getElementById("bridge_ssid").value = "Gargoyle";
		setSelectedValue("bridge_channel", wirelessDriver=="broadcom" ? "5" : "auto");
		setSelectedValue("bridge_encryption", "none");
	}
	var bridgeWdsMacTable=createTable([""], bridgeWdsTableData, "bridge_wds_mac_table", true, false);
	var bridgeWdsTableContainer = document.getElementById('bridge_wds_mac_table_container');
	if(bridgeWdsTableContainer.firstChild != null)
	{
		bridgeWdsTableContainer.removeChild(bridgeWdsTableContainer.firstChild);
	}
	bridgeWdsTableContainer.appendChild(bridgeWdsMacTable);
	setBridgeVisibility();


	//reset default wan mac if isBcm94704 is true
	if(isBcm94704 && uciOriginal.get("network", "wan", "ifname") != wirelessIf && uciOriginal.get("network", "wan", "macaddr") != "")
	{
		var currentMac = uciOriginal.get("network", "wan", "macaddr").toUpperCase();
		var currentStart = currentMac.substr(0, 15);
		var currentEnd = currentMac.substr(15, 2);
		var lanMacIndex=0;
		for(lanMacIndex=0; lanMacIndex < allLanMacs.length; lanMacIndex++)
		{
			var nextMac = allLanMacs[lanMacIndex].toUpperCase();
			var nextStart = nextMac.substr(0,15);
			var nextEnd = nextMac.substr(15,2);
			if(nextStart == currentStart && Math.abs(parseInt(nextEnd,16) - parseInt(currentEnd,16)) == 1)
			{
				defaultWanMac = currentMac;
			}
		}
	}
	
	//set wan proto && wan/wifi/bridge variables
	var wp = uciOriginal.get("network", "wan", "proto");
	var wanUciIf= uciOriginal.get('network', 'wan', 'ifname');
	var lanUciIf= uciOriginal.get('network', 'lan', 'ifname');
	var wanIsWifi = wanUciIf == '' && ( getWirelessMode(uciOriginal) == "sta" || getWirelessMode(uciOriginal) == "ap+sta");
	wp = wp == "" ? "none" : wp;
	if(wp != "none") { wp = wanIsWifi ? wp + "_wireless" : wp + "_wired"; }
	setSelectedValue("wan_protocol", wp);

	setSelectedValue('wan_via_single_port', (wanUciIf == defaultLanIf && defaultWanIf == '') ? "wan" : "lan");
	var wanToLanStatus = lanUciIf.indexOf(defaultWanIf) < 0 ? 'disable' : 'bridge' ;
	setSelectedValue('bridge_wan_port_to_lan', wanToLanStatus);
	setSelectedValue('wan_port_to_lan', wanToLanStatus);



	//first load basic variables for wan & lan sections
	networkIds = ['wan_pppoe_user', 'wan_pppoe_pass', 'wan_pppoe_max_idle','wan_pppoe_reconnect_pings', 'wan_pppoe_interval', 'wan_static_ip', 'wan_static_mask', 'wan_static_gateway', 'wan_use_mac', 'wan_mac', 'wan_use_mtu', 'wan_mtu', 'lan_ip', 'lan_mask', 'lan_gateway'];
	networkPkgs = new Array();
	for (idIndex in networkIds)
	{
		networkPkgs.push('network');
	}

	networkSections = ['wan', 'wan', 'wan', 'wan', 'wan', 'wan', 'wan', 'wan', 'wan', 'wan', 'wan', 'wan', 'lan', 'lan', 'lan'];
	networkOptions  = ['username', 'password', 'demand', 'keepalive', 'keepalive', 'ipaddr', 'netmask', 'gateway', 'macaddr','macaddr', 'mtu', 'mtu', 'ipaddr', 'netmask', 'gateway'];



	pppoeDemandParams = [5*60,1/60];
	pppoeReconnectParams = [3,0];
	pppoeIntervalParams = [5,1];
	useMtuTest = function(v){return (v=='' || v==null || v==1500 ? false : true);}
	useMacTest = function(v){v = (v== null ? '' : v);  return (v=='' || v.toLowerCase()==defaultWanMac.toLowerCase() ? false : true);}

	networkParams = ['', '', pppoeDemandParams, pppoeReconnectParams, pppoeIntervalParams, '10.1.1.10', '255.255.255.0', '127.0.0.1', useMacTest, defaultWanMac, useMtuTest, 1500, '192.168.1.1', '255.255.255.0', '192.168.1.1'];

	

	

	lv=loadValueFromVariable;
	lsv=loadSelectedValueFromVariable;
	lvm=loadValueFromVariableMultiple;
	lvi=loadValueFromVariableAtIndex;
	lc=loadChecked;
	networkFunctions = [lv,lv,lvm,lvi,lvi,lv,lv,lv,lc,lv,lc,lv,lv,lv,lv];
	
	loadVariables(uciOriginal, networkIds, networkPkgs, networkSections, networkOptions, networkParams, networkFunctions);

	if(uciOriginal.get('network', 'wan', 'proto') == '')
	{
		document.getElementById('wan_protocol').value='none';
	}	
	
	enableAssociatedField(document.getElementById('wan_use_mac'), 'wan_mac', defaultWanMac);
	enableAssociatedField(document.getElementById('wan_use_mtu'), 'wan_mtu', 1500);


	//note: we have to set pppoe_reconnect_mode in a custom manner, it is a bit non-standard
	keepalive=uciOriginal.get("network", "wan", "keepalive");
	demand=uciOriginal.get("network", "wan", "demand");
	reconnect_mode=(keepalive != '' || demand == '') ? 'keepalive' : 'demand';
	document.getElementById("wan_pppoe_reconnect_mode").value = reconnect_mode;
	
	//initialize dns table
	var origDns = uciOriginal.get("netowrk", "lan", "dns").split(/[\t ]+/);
	var routerIp = uciOriginal.get("network", "lan", "ipaddr");
	var dIndex = 0;
	var dnsTableData = [];
	for(dIndex=0; dIndex < origDns.length; dIndex++)
	{
		if(origDns[dIndex] != routerIp && validateIP(origDns[dIndex]) == 0)
		{
			dnsTableData.push([origDns[dIndex]]);
		}
	}
	
	var lanDnsTable=createTable([""], dnsTableData, "lan_dns_table", true, false);
	var lanDnsTableContainer = document.getElementById('lan_dns_table_container');
	if(lanDnsTableContainer.firstChild != null)
	{
		lanDnsTableContainer.removeChild(lanDnsTableContainer.firstChild);
	}
	lanDnsTableContainer.appendChild(lanDnsTable);

	var bridgeDnsTable = createTable([""], dnsTableData, "bridge_dns_table", true, false);
	var bridgeDnsTableContainer = document.getElementById('bridge_dns_table_container');
	if(bridgeDnsTableContainer.firstChild != null)
	{
		bridgeDnsTableContainer.removeChild(bridgeDnsTableContainer.firstChild);
	}
	bridgeDnsTableContainer.appendChild(bridgeDnsTable);


	document.getElementById("lan_use_dns").checked = dnsTableData.length > 0 ? true : false;
	setDnsEnabled(document.getElementById("lan_use_dns")); //bridge check gets set automatically



	
	//now load wireless variables
	var allWirelessSections = uciOriginal.getAllSections("wireless");
	var allWifiDeviceSections = uciOriginal.getAllSectionsOfType("wireless", "wifi-device");
	var firstWirelessDevice = allWifiDeviceSections[0];

	wifiCfg2="";
	wifiCfg3="";
	if(allWirelessSections.length >= 2)
	{
		wifiCfg2 = allWirelessSections[1];
	}
	if(allWirelessSections.length >= 3)
	{
		wifiCfg3 = allWirelessSections[2];
	}
	cfg2mode=uciOriginal.get("wireless", wifiCfg2, "mode");
	cfg3mode=uciOriginal.get("wireless", wifiCfg3, "mode");
	apcfg=  cfg2mode== 'ap' ? wifiCfg2 : (cfg3mode=='ap' ? wifiCfg3 : '' );
	othercfg= apcfg== wifiCfg3 || apcfg== '' ? wifiCfg2 : wifiCfg3;
	if(uciOriginal.get("wireless", othercfg, "mode") == "wds")
	{
		othercfg = '';
	}




	wirelessIds=['wifi_channel1', 'wifi_channel2', 'wifi_ssid1', 'wifi_encryption1', 'wifi_pass1', 'wifi_wep1', 'wifi_server1', 'wifi_port1', 'wifi_ssid2', 'wifi_encryption2', 'wifi_pass2', 'wifi_wep2'];
	wirelessPkgs= new Array();
	var wIndex;
	for(wIndex=0; wIndex < wirelessIds.length; wIndex++)
	{
		wirelessPkgs.push('wireless');
	}
	wirelessSections=[firstWirelessDevice, firstWirelessDevice, apcfg, apcfg, apcfg, apcfg, apcfg, apcfg, othercfg, othercfg, othercfg, othercfg];
	wirelessOptions=['channel', 'channel', 'ssid', 'encryption', 'key', 'key', 'server', 'port', 'ssid', 'encryption', 'key','key'];
	wirelessParams=[wirelessDriver=="broadcom" ? '5' : "auto", wirelessDriver=="broadcom" ? '5' : "auto", 'Gargoyle', 'none', '', '', '', '', 'OpenWrt', 'none', '',''];
	wirelessFunctions=[lsv,lsv,lv,lsv,lv,lv,lv,lv,lv,lsv,lv,lv];
	resetWirelessMode();
	loadVariables(uciOriginal, wirelessIds, wirelessPkgs, wirelessSections, wirelessOptions, wirelessParams, wirelessFunctions);	


	setSelectedValue('wifi_channel1', uciOriginal.get("wireless", firstWirelessDevice, "channel"));
	setSelectedValue('wifi_channel2', uciOriginal.get("wireless", firstWirelessDevice, "channel"));
	setSelectedValue('bridge_channel', uciOriginal.get("wireless", firstWirelessDevice, "channel"));

	setSelectedValue('wifi_hidden', uciOriginal.get("wireless", apcfg, "hidden")==1 ? "disabled" : "enabled")
	setSelectedValue('wifi_isolate', uciOriginal.get("wireless", apcfg, "isolate")==1 ? "enabled" : "disabled")


	
	setSelectedValue("mac_filter_enabled", 'disabled');
	var macListStr = '';
	var policy = '';
	if(wirelessDriver == "broadcom")
	{
		policy = uciOriginal.get("wireless", firstWirelessDevice, policyOption);
		macListStr = uciOriginal.get("wireless", firstWirelessDevice, "maclist");
		setSelectedValue("mac_filter_enabled", ( (policy == "allow" || policy == "deny" || policy == "1" || policy == "2" ) && macListStr != "") ? 'enabled' : 'disabled');
	}
	else if(wirelessDriver == "atheros")
	{
		/*
		Atheros has definitions in interface sections, broadcom in wifi-device section.
		To keep consistency we apply first atheros mac filter defined (if any) to all sections
		
		Granted, this means you can not use the enhanced atheros functionality of specifying mac
		filters on a per-interface basis.  However, I believe consistency is more important than
		flexibility in this case.  The interface will seem to the user to be identical on all platforms
		and that is my highest priority.
		
		Here, if mac filter is active on any interface we apply to all of them
		I am not sure this is the best policy, but the alternative is ditching the filter
		which someone may want and went to some trouble to configure.  I do it this way
		because the majority of the time users will only have one AP interface
		*/
		for(wsecIndex=0; wsecIndex < allWirelessSections.length && getSelectedValue("mac_filter_enabled") == "disabled"; wsecIndex++)
		{
			macListStr = uciOriginal.get("wireless", allWirelessSections[wsecIndex], "maclist");
			if(macListStr != '')
			{
				policy = uciOriginal.get("wireless", allWirelessSections[wsecIndex], policyOption);
				setSelectedValue("mac_filter_enabled", "enabled");
			}
		}
	}
	if(policy == '1' || policy == 'deny')
	{
		setSelectedValue("mac_filter_policy", "deny");
	}
	else
	{
		setSelectedValue("mac_filter_policy", "allow");
	}

	macList = macListStr.split(/[;,\t ]+/);
	macTableData=[];
	if(macListStr.match(/:/))
	{
		for(macIndex=0; macIndex < macList.length; macIndex++)
		{
			macTableData.push([ macList[macIndex] ]);
		}
	}

	macTable=createTable([""], macTableData, "mac_table", true, false);
	tableContainer = document.getElementById('mac_table_container');
	if(tableContainer.firstChild != null)
	{
		tableContainer.removeChild(tableContainer.firstChild);
	}
	tableContainer.appendChild(macTable);





	encryptNum = 1;
	while (encryptNum <= 2)
	{
		encMode = document.getElementById('wifi_encryption' + encryptNum).value;
		if(encMode == 'wep')
		{
			document.getElementById('wifi_pass' + encryptNum).value = '';
		}
		else if(encMode != 'none')
		{
			document.getElementById('wifi_wep' + encryptNum).value = '';
		}
		else
		{
			document.getElementById('wifi_pass' + encryptNum).value = '';
			document.getElementById('wifi_wep' + encryptNum).value = '';
		}
		encryptNum++;
	}



	//load bssids for wds if necessary
	var wifiWdsData = [];
	if(apcfg != "")
	{
		var sectionIndex=0;
		var atherosFound = false;
		for(sectionIndex=0; sectionIndex < allWirelessSections.length && (!atherosFound); sectionIndex++)
		{
			if(wirelessDriver == "broadcom")
			{
				if(uciOriginal.get("wireless", allWirelessSections[sectionIndex], "mode") == "wds")
				{
					wifiWdsData.push( [ uciOriginal.get("wireless", allWirelessSections[sectionIndex].toUpperCase(), "bssid")  ] );
					setSelectedValue("wifi_mode", "ap+wds");
				}
			}
			else //atheros
			{
				if(uciOriginal.get("wireless", allWirelessSections[sectionIndex], "wds") == "1")
				{
					atherosFound = true;
					var bSplit = uciOriginal.get("wireless", allWirelessSections[sectionIndex], "bssid").split(/[\t ]+/);;
					var bIndex=0;
					for(bIndex=0; bIndex < bSplit.length; bIndex++)
					{
						wifiWdsData.push( [ bSplit[bIndex].toUpperCase() ]);
						setSelectedValue("wifi_mode", "ap+wds");
					}
				}
			}
		}
			
	}
	var wifiWdsMacTable=createTable([""], wifiWdsData, "wifi_wds_mac_table", true, false);
	var wifiWdsTableContainer = document.getElementById('wifi_wds_mac_table_container');
	if(wifiWdsTableContainer.firstChild != null)
	{
		wifiWdsTableContainer.removeChild(wifiWdsTableContainer.firstChild);
	}
	wifiWdsTableContainer.appendChild(wifiWdsMacTable);



	proofreadAll();	
	setGlobalVisibility();
}

function setChannel(selectElement)
{
	var selectedValue = getSelectedValue(selectElement.id);
	setSelectedValue("wifi_channel1",  selectedValue);
	setSelectedValue("wifi_channel2",  selectedValue);
	setSelectedValue("bridge_channel", selectedValue);
}

function resetWirelessMode()
{
	setSelectedValue('wifi_mode', getWirelessMode(uciOriginal));
}

function validateWep(text)
{
	return (validateHex(text) == 0 && (text.length == 10 || text.length == 26)) ? 0 : 1;
}

function proofreadWep(input)
{
	proofreadText(input, validateWep, 0);
}


function addTextToSingleColumnTable(textId, tableContainerId, validator, preprocessor, validReturn, duplicatesAllowed, columnName)
{
	var val=document.getElementById(textId).value;
	if(validator(val) != validReturn)
	{
		alert("ERROR: Specified " + columnName + " is not valid.");
	}
	else
	{
		val = preprocessor(val);
		var singleTable = document.getElementById(tableContainerId).firstChild;
		var singleTableData = getTableDataArray(singleTable, true, false);
		var inTable = false;
		var tabIndex = 0
		for(tabIndex = 0; tabIndex < singleTableData.length; tabIndex++)
		{
			var test = singleTableData[macIndex];
			inTable = inTable || (val == test[0]);
		}
		if(inTable && !duplicatesAllowed)
		{
			alert("ERROR: Duplicate " + columnName);
		}
		else
		{
			addTableRow(singleTable, [val], true, false, null, null );
			document.getElementById(textId).value = "";
		}
	}
}

function setDnsEnabled(useDnsCheck)
{
	var enabled = useDnsCheck.checked;


	document.getElementById("bridge_use_dns").checked = enabled;
	setElementEnabled(document.getElementById("add_bridge_dns"), enabled, "");
	setElementEnabled(document.getElementById("add_bridge_dns_button"), enabled, "");
	document.getElementById("bridge_dns_table_container").style.display = enabled ? "block" : "none";

	
	document.getElementById("lan_use_dns").checked = enabled;
	setElementEnabled(document.getElementById("add_lan_dns"), enabled, "");
	setElementEnabled(document.getElementById("add_lan_dns_button"), enabled, "");
	document.getElementById("lan_dns_table_container").style.display = enabled ? "block" : "none";
}

function addDns(section)
{
	var textId = "add_" + section + "_dns";
	addIp = document.getElementById(textId).value;
	addTextToSingleColumnTable(textId, "lan_dns_table_container", validateIP, function(str){ return str; }, 0, false, "IP"); 
	if(addIp != "" && document.getElementById(textId).value == "")
	{

		document.getElementById(textId).value = addIp;
		addTextToSingleColumnTable("add_" + section + "_dns", "bridge_dns_table_container", validateIP, function(str){ return str; }, 0, false, "IP"); 
	}
}

function addMacToWds(section)
{
	var textId = "add_" + section + "_wds_mac";
	var tableContainer = section + "_wds_mac_table_container";
	addTextToSingleColumnTable(textId, tableContainerId, validateMac, function(str){ return str.toUpperCase(); }, 0, false, "MAC"); 
}


function addMacToFilter()
{
	addTextToSingleColumnTable("add_mac", "mac_table_container", validateMac, function(str){ return str.toUpperCase(); }, 0, false, "MAC"); 
}

function scanWifi(ssidField)
{
	setControlsEnabled(false, true, "Scanning For Wifi Networks");
	var param = getParameterDefinition("commands", "");
	var stateChangeFunction = function(req)
	{
		if(req.readyState == 4)
		{
			scannedSsids = parseWifiScan(req.responseText);	
			if(scannedSsids[0].length > 0)
			{
				var oldSsid = document.getElementById(ssidField).value;
				document.getElementById("wifi_custom_ssid2").value = oldSsid;
				document.getElementById("bridge_custom_ssid").value = oldSsid;
				
				var ssidDisplay = [];
				var ssidValue = [];
				var ssidIndex=0;
				for(ssidIndex=0; ssidIndex < scannedSsids[0].length; ssidIndex++)
				{
					var ssid = scannedSsids[0][ssidIndex];
					var enc  = scannedSsids[1][ssidIndex];
					var qual = scannedSsids[3][ssidIndex];

					enc = enc =="none" ? "Open" :  enc.replace(/psk/g, "wpa").toUpperCase();
					ssidDisplay.push( ssid + " (" + enc + ", " + qual +"% Signal)");
					ssidValue.push(ssidIndex + "");
				}
				ssidDisplay.push( "Custom" );
				ssidValue.push(  "custom" );
				
				setAllowableSelections("wifi_list_ssid2", ssidValue, ssidDisplay);
				setAllowableSelections("bridge_list_ssid", ssidValue, ssidDisplay);
				setSelectedValue("wifi_list_ssid2", "0");
				setSelectedValue("bridge_list_ssid", "0");	
			}
			else
			{
				alert("No Wireless Networks found!");
			}
			setSsidVisibility("wifi_list_ssid2");
			setControlsEnabled(true);
		}
	}
	runAjax("POST", "utility/scan_wifi.sh", param, stateChangeFunction);

}

function setSsidVisibility(selectId)
{
	var visIds =	[	
			"bridge_list_ssid_container", "bridge_custom_ssid_container", "bridge_ssid_container", "bridge_channel_container", "bridge_fixed_channel_container", "bridge_encryption_container", "bridge_fixed_encryption_container",
	   		"wifi_list_ssid2_container", "wifi_custom_ssid2_container", "wifi_ssid2_container",   "wifi_channel2_container",  "wifi_fixed_channel2_container",  "wifi_encryption2_container",  "wifi_fixed_encryption2_container",
			'wifi_fixed_channel1',
			'wifi_pass2_container', 'wifi_wep2_container', 'bridge_pass_container', 'bridge_wep_container'
			];
	if(scannedSsids[0].length > 0)
	{
		var ic = getSelectedValue(selectId) == "custom" ? 1 : 0;
		var inc = ic == 0 ? 1 : 0;
		if(inc)
		{
			var scannedIndex = parseInt(getSelectedValue(selectId));
			var enc  = scannedSsids[1][scannedIndex];
			var chan = scannedSsids[2][scannedIndex];
			
			setSelectedValue("wifi_encryption2", enc);
			setSelectedValue("bridge_encryption", enc);
			setSelectedValue("wifi_channel1", chan);
			setSelectedValue("wifi_channel2", chan);
			setSelectedValue("bridge_channel", chan);
			
			enc = getSelectedText("wifi_encryption2");
			setChildText("wifi_fixed_encryption2", enc);
			setChildText("bridge_fixed_encryption", enc);
			setChildText("wifi_fixed_channel1", chan);
			setChildText("wifi_fixed_channel2", chan);
			setChildText("bridge_fixed_channel", chan);
		}
		var be = getSelectedValue('bridge_encryption');
		var we = getSelectedValue('wifi_encryption2');
		var bp = be.match(/psk/) || be.match(/WPA/) ? 1 : 0;
		var bw = be.match(/wep/) || be.match(/WEP/) ? 1 : 0;
		var wp = we.match(/psk/) || we.match(/WPA/) ? 1 : 0;
		var ww = we.match(/wep/) || we.match(/WEP/) ? 1 : 0;
		setVisibility(visIds , [1,ic,0,ic,inc,ic,inc,  1,ic,0,ic,inc,ic,inc,  inc,  wp,ww,bp,bw] );
	}
	else
	{
		var be = getSelectedValue('bridge_encryption');
		var we = getSelectedValue('wifi_encryption2');
		var bp = be.match(/psk/) || be.match(/WPA/) ? 1 : 0;
		var bw = be.match(/wep/) || be.match(/WEP/) ? 1 : 0;
		var wp = we.match(/psk/) || we.match(/WPA/) ? 1 : 0;
		var ww = we.match(/wep/) || we.match(/WEP/) ? 1 : 0;
		setVisibility(visIds, [0,0,1,1,0,1,0,          0,0,1,1,0,1,0,         0,    wp,ww,bp,bw] );
	}
}

function parseWifiScan(rawScanOutput)
{
	var parsed = [ [],[],[],[] ];
	var cells = rawScanOutput.split(/Cell/);
	cells.shift(); //get rid of anything before first AP data
	
	var getCellValues=function(id, cellLines)
	{
		var vals=[];
		var lineIndex;
		for(lineIndex=0; lineIndex < cellLines.length && val==null; lineIndex++)
		{
			var line = cellLines[lineIndex];
			var idIndex = line.indexOf(id);
			var cIndex = line.indexOf(":");
			if(idIndex >= 0 && cIndex > idIndex)
			{
				var val=line.substr(cIndex+1);
				val = val.replace(/^[^\"]*\"/g, "");
				val = val.replace(/\".*$/g, "");
				vals.push(val);
			}
		}
		return vals;
	}
	
	while(cells.length > 0)
	{
		var cellData = cells.shift();
		var cellLines = cellData.split(/[\r\n]+/);
		var ssid = getCellValues("ESSID", cellLines).shift();
		var channel = getCellValues("Channel", cellLines).shift();
		var encOn = getCellValues("Encryption key", cellLines).shift();
		var ie = getCellValues("IE", cellLines);
		var qualStr = getCellValues("Quality", cellLines).shift();
		if(ssid != null && ssid != "" && encOn != null && qualStr != null)
		{
			var encType = "wep";
			while(ie.length > 0)
			{
				e = ie.shift();
				encType = e.match(/WPA2/) ? "psk2" : encType;
				encType = encType=="wep" && e.match(/WPA/) ? "psk" : encType;
			}
			var enc = encOn == "on" ? encType : "none";
			
			var splitQual =qualStr.replace(/[\t ]+Sig.*$/g, "").split(/\//);
			var quality = Math.round( (parseInt(splitQual[0])*100)/parseInt(splitQual[1]) );
			

			parsed[0].push(ssid);
			parsed[1].push(enc);
			parsed[2].push(channel);
			parsed[3].push(quality);
		}
	}

	var qualityIndices = [];
	var qIndex;
	for(qIndex=0; qIndex < parsed[3].length; qIndex++) { qualityIndices.push( [ qIndex, parsed[3][qIndex] ] ); }
	var sortQuality = function(q1,q2){ return q2[1] - q1[1]; };
	qualityIndices = qualityIndices.sort(sortQuality);
	
	var sortedParsed = [ [],[],[],[] ];
	while(qualityIndices.length > 0)
	{
		var i = qualityIndices.shift()[0];
		var pIndex;
		for(pIndex=0; pIndex < 4; pIndex++){ sortedParsed[pIndex].push( parsed[pIndex][i] ); }
	}


	return sortedParsed;
}

