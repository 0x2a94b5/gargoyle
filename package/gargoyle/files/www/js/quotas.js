var pkg = "firewall";
var changedIds = [];

function saveChanges()
{
	setControlsEnabled(false, true);
	
	//remove old quotas
	var preCommands = [];
	var allOriginalQuotas = uciOriginal.getAllSectionsOfType(pkg, "quota");
	while(allOriginalQuotas.length > 0)
	{
		var section = allOriginalQuotas.shift();
		uciOriginal.removeSection(pkg, section);
		preCommands.push("uci del " + pkg + "." + section);	
	}
	preCommands.push("uci commit");

	var allNewQuotas = uci.getAllSectionsOfType(pkg, "quota");
	var quotaUseVisibleCommand = "\nuci del gargoyle.status.quotause ; uci commit ;\n"
	while(allNewQuotas.length > 0)
	{
		//if ip has changed, reset saved data
		var section = allNewQuotas.shift()
		if( changedIds[ uci.get(pkg,section,"ip") ] == 1 )
		{
			uci.set(pkg, section, "ignore_backup_at_next_restore", "1");
		}
		quotaUseVisibleCommand = "\nuci set gargoyle.status.quotause=\"225\" ; uci commit ;\n"
	}

	//set enabled / disabled	
	var quotaTable = document.getElementById('quota_table_container').firstChild;
	var quotaTableData = getTableDataArray(quotaTable, true, false);
	var qtIndex=0;
	for(qtIndex=0; qtIndex < quotaTableData.length; qtIndex++)
	{
		var enabledCheck = quotaTableData[qtIndex][4];
		uci.set(pkg, enabledCheck.id, "enabled", (enabledCheck.checked ? "1" : "0") )
	}

	var postCommands = [];
	postCommands.push("sh /usr/lib/gargoyle/restart_firewall.sh");
	postCommands.push("if [ -d \"/usr/data/quotas/\" ] ; then rm -rf /usr/data/quotas/* ; fi ;");
	postCommands.push("backup_quotas");
	var commands = preCommands.join("\n") + "\n" + uci.getScriptCommands(uciOriginal) + "\n" + quotaUseVisibleCommand + "\n" + postCommands.join("\n");

	var param = getParameterDefinition("commands", commands) + "&" + getParameterDefinition("hash", document.cookie.replace(/^.*hash=/,"").replace(/[\t ;]+.*$/, ""));
	var stateChangeFunction = function(req)
	{
		if(req.readyState == 4)
		{
			//just reload page -- it's easier than any other mechanism to load proper quota data from uci
			setControlsEnabled(true);
			window.location.href = window.location.href;	
		}
	}

	runAjax("POST", "utility/run_commands.sh", param, stateChangeFunction);
}


function resetData()
{
	//table columns: ip, percent upload used, percent download used, percent combined used, enabled, edit, remove
	var quotaSections = uciOriginal.getAllSectionsOfType(pkg, "quota");
	var quotaTableData = [];
	var checkElements = []; //because IE is a bitch and won't register that checkboxes are checked/unchecked unless they are part of document
	var areChecked = [];
	changedIds = [];
	for(sectionIndex = 0; sectionIndex < quotaSections.length; sectionIndex++)
	{
		var ip = uciOriginal.get(pkg, quotaSections[sectionIndex], "ip").toUpperCase();
		var id = uciOriginal.get(pkg, quotaSections[sectionIndex], "id");
		if(id == "")
		{
			id = getIdFromIp(ip);
			uci.set(pkg, quotaSections[sectionIndex], "id", id);
		}

		var pctUp       = "N/A";
		var pctDown     = "N/A";
		var pctCombined = "N/A";
		if(quotaPercents[id] != null)
		{
			var pcts = quotaPercents[id];
			pctUp = pcts[0] >= 0 ? pcts[0] + "%" : pctUp;
			pctDown = pcts[1] >= 0 ? pcts[1] + "%" : pctDown;
			pctCombined = pcts[2] >= 0 ? pcts[2] + "%" : pctCombined;
		}		
		
		var enabled = uciOriginal.get(pkg, quotaSections[sectionIndex], "enabled");
		enabled = enabled != "0" ? true : false;
	
		
		var enabledCheck = createEnabledCheckbox(enabled);
		enabledCheck.id= id;
		checkElements.push(enabledCheck);
		areChecked.push(enabled);

		quotaTableData.push( [ (ip.length > 30 ? ip.substr(0,27)+"..." : ip), pctUp, pctDown, pctCombined, enabledCheck, createEditButton(enabled) ] );
	

	}

	
	columnNames=["IP", "% Upload Used", "% Download Used", "% Combined Used", "", "" ];
	quotaTable = createTable(columnNames, quotaTableData, "quota_table", true, false, removeQuotaCallback);
	tableContainer = document.getElementById('quota_table_container');
	if(tableContainer.firstChild != null)
	{
		tableContainer.removeChild(tableContainer.firstChild);
	}
	tableContainer.appendChild(quotaTable);

	while(checkElements.length > 0)
	{
		var c = checkElements.shift();
		var b = areChecked.shift();
		c.checked = b;
	}
	
	setDocumentFromUci(document, new UCIContainer(), "");
	
	setVisibility(document);
}

function getIdFromIp(ip)
{
	id = ip == "" ? "ALL" : ip.replace(/[\t, ]+.*$/, "");
	id = id.replace(/\//, "_");
			
	var idPrefix = id;
	var found = true;
	var suffixCount = 0;

	var quotaSections = uci.getAllSectionsOfType(pkg, "quota");

	while(found == true)
	{
		found = false;
		var sectionIndex;
		for(sectionIndex=0; sectionIndex < quotaSections.length && (!found); sectionIndex++)
		{
			found = found || uci.get(pkg, quotaSections[sectionIndex], "id") == id;
		}
		if(found)
		{
			var letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
			var suffix = suffixCount < 26 ? "_" + letters.substr(suffix,1) : "_Z" + (suffixCount-25);
			id = idPrefix + suffix;
		}
	}
	return id;

}


function getIpFromDocument(controlDocument)
{
	controlDocument = controlDocument == null ? document : controlDocument;
	var ip = "ALL";
	if(getSelectedValue("applies_to_type", controlDocument) == "all")
	{
		ip = "ALL";
	}
	else if(getSelectedValue("applies_to_type", controlDocument) == "others_combined")
	{
		ip = "ALL_OTHERS_COMBINED";
	}
	else if(getSelectedValue("applies_to_type", controlDocument) == "others_individual")
	{
		ip = "ALL_OTHERS_INDIVIDUAL";
	}
	else if(getSelectedValue("applies_to_type", controlDocument) == "only")
	{
		ip = controlDocument.getElementById("applies_to").value; 
	}
	return ip;
}

function setDocumentIp(ip, controlDocument)
{
	ip = ip== ""  ? "ALL" : ip;
	controlDocument = controlDocument == null ? document : controlDocument;
	controlDocument.getElementById("applies_to").value = "";
	if(ip == "ALL")
	{
		setSelectedValue("applies_to_type", "all", controlDocument);
	}
	else if(ip == "ALL_OTHERS_COMBINED")
	{
		setSelectedValue("applies_to_type", "others_combined", controlDocument);
	}
	else if(ip == "ALL_OTHERS_INDIVIDUAL")
	{
		setSelectedValue("applies_to_type", "others_individual", controlDocument);
	}
	else
	{
		setSelectedValue("applies_to_type", "only", controlDocument);
		controlDocument.getElementById("applies_to").value = ip;
	}
}


function addNewQuota()
{
	var errors = validateQuota(document, "", "none");
	if(errors.length > 0)
	{
		alert(errors.join("\n") + "\nCould not add quota.");
	}
	else
	{
		var quotaNum = 1;
		while( uci.get(pkg, "quota_" + quotaNum, "") != "") { quotaNum++; }

		setUciFromDocument(document, "");

		
		var enabledCheck = createEnabledCheckbox(true);
		enabledCheck.id = uci.get(pkg, "quota_" + quotaNum, "id");

		var tableContainer = document.getElementById("quota_table_container");
		var table = tableContainer.firstChild;
		var down = uci.get(pkg, "quota_" + quotaNum, "ingress_limit") == "" ? "N/A" : "0"; 
		var up = uci.get(pkg, "quota_" + quotaNum, "egress_limit") == "" ? "N/A" : "0"; 
		var combined = uci.get(pkg, "quota_" + quotaNum, "combined_limit") == "" ? "N/A" : "0"; 
		var ip = getIpFromDocument(document);
		addTableRow(table, [ip.replace(/_/g, " "), up, down, combined, enabledCheck, createEditButton(true)], true, false, removeQuotaCallback);	

		setDocumentFromUci(document, new UCIContainer(), "");

		enabledCheck.checked = true;
	}
}

function setVisibility(controlDocument)
{
	controlDocument = controlDocument == null ? document : controlDocument;
	setInvisibleIfIdMatches("applies_to_type", ["all","others_combined", "others_individual"], "applies_to", "inline", controlDocument);
	setInvisibleIfIdMatches("quota_reset", ["hour", "day"], "quota_day_container", "block", controlDocument);
	setInvisibleIfIdMatches("quota_reset", ["hour"], "quota_hour_container", "block", controlDocument);
	setInvisibleIfIdMatches("max_up_type", ["unlimited"], "max_up_container", "inline", controlDocument);
	setInvisibleIfIdMatches("max_down_type", ["unlimited"], "max_down_container", "inline", controlDocument);
	setInvisibleIfIdMatches("max_combined_type", ["unlimited"], "max_combined_container", "inline", controlDocument);
	
	setInvisibleIfIdMatches("quota_active", ["always"], "quota_active_type", "inline", controlDocument);
	setInvisibleIfIdMatches("quota_active", ["always"], "quota_active_controls_container", "block", controlDocument);
	setInvisibleIfIdMatches("quota_active_type", ["days", "weekly_range"], "active_hours_container", "block", controlDocument);
	setInvisibleIfIdMatches("quota_active_type", ["hours", "weekly_range"], "active_days_container", "block", controlDocument);
	setInvisibleIfIdMatches("quota_active_type", ["hours", "days", "days_and_hours"], "active_weekly_container", "block", controlDocument);

	


	var qri=getSelectedValue("quota_reset", controlDocument);
	if(qri == "month")
	{
		var vals = [];	
		var names = [];	
		var day=1;
		for(day=1; day <= 28; day++)
		{
			var dayStr = "" + day;
			var lastDigit = dayStr.substr( dayStr.length-1, 1);
			var suffix="th"
			if( day % 100  != 11 && lastDigit == "1")
			{
				suffix="st"
			}
			if( day % 100 != 12 && lastDigit == "2")
			{
				suffix="nd"
			}
			if( day %100 != 13 && lastDigit == "3")
			{
				suffix="rd"
			}
			names.push(dayStr + suffix);
			vals.push( ((day-1)*60*60*24) + "" );
		}
		setAllowableSelections("quota_day", vals, names, controlDocument);
	}
	if(qri == "week")
	{
		var names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
		var vals = [];
		var dayIndex;
		for(dayIndex=0; dayIndex < 7; dayIndex++)
		{
			vals.push( (dayIndex*60*60*24) + "")
		}
		setAllowableSelections("quota_day", vals, names, controlDocument);
	}
}

function setInvisibleIfIdMatches(selectId, invisibleOptionValues, associatedElementId, defaultDisplayMode, controlDocument )
{
	controlDocument = controlDocument == null ? document : controlDocument;
	defaultDisplayMode = defaultDisplayMode == null ? "block" : defaultDisplayMode;
	var visElement = controlDocument.getElementById(associatedElementId);
	var matches = false;
	var matchIndex=0;
	if(visElement != null)
	{
		for (matchIndex=0; matchIndex < invisibleOptionValues.length; matchIndex++)
		{
			matches = getSelectedValue(selectId, controlDocument) == invisibleOptionValues[matchIndex] ? true : matches;
		}
		if(matches)
		{
			visElement.style.display = "none";
		}
		else
		{
			visElement.style.display = defaultDisplayMode;
		}
	}
}

function getDaySeconds(offset)
{
	return ( Math.floor(offset/(60*60*24))*(60*60*24)) ;
}
function getHourSeconds(offset)
{
	return ( Math.floor((offset%(60*60*24))/(60*60)) * (60*60) );
}



function parsePaddedInt(intStr)
{
	intStr = intStr.replace(/[\t ]+/, "");
	intStr = intStr.replace(/^0+/, "");
	return parseInt(intStr);
}

function getIpInteger(ipStr)
{
	var ip = ipStr.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
	if(ip)
	{
		return (+parsePaddedInt(ip[1])<<24) + (+parsePaddedInt(ip[2])<<16) + (+parsePaddedInt(ip[3])<<8) + (+parsePaddedInt(ip[4]));
	}
	return null;
}
function getMaskInteger(maskSize)
{
	return -1<<(32-parsePaddedInt(maskSize))
}
function getIpMaskIntegers(ipStr)
{
	var ipInt = 0;
	var ipMaskInt = getMaskInteger(32);
	if(ipStr.match(/\//))
	{
		var split = ipStr.split(/\//);
		ipInt = getIpInteger(split[0]);
		ipMaskInt = (split[1]).match(/\./) ? getIpInteger(split[1]) : getMaskInteger(split[1]);
		ipInt = ipInt & ipMaskInt;
	}
	else
	{
		ipInt = getIpInteger(ipStr);
	}
	return [ipInt, ipMaskInt];
}

function testSingleIpOverlap(ipStr1, ipStr2)
{
	var adj = function(ipStr)
	{
		ipStr = ipStr == "" ? "ALL" : ipStr;	
		if(ipStr == "ALL_OTHERS_COMBINED" || ipStr == "ALL_OTHERS_INDIVIDUAL")
		{
			ipStr = "ALL_OTHERS_COMBINED";
		}
		return ipStr;
	}
	ipStr1 = adj(ipStr1);
	ipStr2 = adj(ipStr2);

	var matches;
	if(ipStr1 == ipStr2)
	{
		matches = true;
	}
	else
	{
		var parsed1 = getIpMaskIntegers(ipStr1);
		var parsed2 = getIpMaskIntegers(ipStr2);
		var minMask = parsed1[1] | parsed2[1];
		matches = (parsed1[0] & minMask) == (parsed2[0] & minMask);
	}
	return matches;
}

function testIpOverlap(ipStr1, ipStr2)
{
	ipStr1 = ipStr1.replace(/^[\t ]+/, "");
	ipStr1 = ipStr1.replace(/[\t ]+$/, "");
	ipStr2 = ipStr1.replace(/^[\t ]+/, "");
	ipStr2 = ipStr1.replace(/[\t ]+$/, "");

	var split1 = ipStr1.split(/[,\t ]+/);
	var split2 = ipStr1.split(/[,\t ]+/);
	var index1;
	var overlapFound = false;
	for(index1=0; index1 < split1.length && (!overlapFound); index1++)
	{
		var index2;
		for(index2=0; index2 <split2.length && (!overlapFound); index2++)
		{
			overlapFound = overlapFound || testSingleIpOverlap(split1[index1], split2[index2]);
		}
	}
	return overlapFound;
}

function timeVariablesToWeeklyRanges(hours, days, weekly, invert)
{
	var hours = hours == null ? "" : hours;
	var days = days == null ? "" : days;
	var weekly = weekly == null ? "" : weekly;
	
	var dayToIndex = [];
	dayToIndex["SUN"] = 0;
	dayToIndex["MON"] = 1;
	dayToIndex["TUE"] = 2;
	dayToIndex["WED"] = 3;
	dayToIndex["THU"] = 4;
	dayToIndex["FRI"] = 5;
	dayToIndex["SAT"] = 6;


	var splitRangesAtEnd = function(rangeList, max)
	{
		var startEndPairs = [];
		var rangeIndex;
		for(rangeIndex=0;rangeIndex < rangeList.length; rangeIndex=rangeIndex+2)
		{
			if(rangeList[rangeIndex+1] < rangeList[rangeIndex])
			{
				var oldEnd = rangeList[rangeIndex+1];
				rangeList[rangeIndex+1] = max;
				rangeList.push(0);
				rangeList.push(oldEnd);
			}
			var s = rangeList[rangeIndex];
			var e = rangeList[rangeIndex+1];
			startEndPairs.push( [s,e] );
		}
		
		//sort based on starts
		var sortPairs = function(a,b){ return a[0] - b[0]; }
		var sortedPairs = startEndPairs.sort(sortPairs);
		var newRanges = [];
		for(rangeIndex=0;rangeIndex < sortedPairs.length; rangeIndex++)
		{
			newRanges.push( sortedPairs[rangeIndex][0] );
			newRanges.push( sortedPairs[rangeIndex][1] );
		}
		return newRanges;
	}


	var ranges = [];
	if(hours == "" && days == "" && weekly == "")
	{
		ranges = [0, 7*24*60*60];
		invert = false;
	}
	else if(weekly != "")
	{
		var parsePiece = function(piece)
		{
			var splitPiece = piece.split(/[:\t ]+/);
			var dayName = (splitPiece[0]).substr(0,3).toUpperCase();
			splitPiece[0] = dayToIndex[dayName] != null ? dayToIndex[dayName]*24*60*60 : 0;
			splitPiece[1] = parsePaddedInt(splitPiece[1]) + "" != "NaN" ? parsePaddedInt(splitPiece[1])*60*60 : 0;
			splitPiece[2] = parsePaddedInt(splitPiece[2]) + "" != "NaN" ? parsePaddedInt(splitPiece[2])*60 : 0;
			splitPiece[3] = splitPiece[3] != null ? ( parsePaddedInt(splitPiece[3]) + "" != "NaN" ? parsePaddedInt(splitPiece[3]) : 0) : 0;
			return splitPiece[0] + splitPiece[1] + splitPiece[2] + splitPiece[3];
		}
		var pairs = weekly.split(/[\t ]*,[\t ]*/);
		var pairIndex;
		for(pairIndex=0; pairIndex < pairs.length; pairIndex++)
		{

			var pieces = (pairs[pairIndex]).split(/[\t ]*\-[\t ]*/);
			ranges.push(parsePiece(pieces[0]));
			ranges.push(parsePiece(pieces[1]));
		}
		ranges = splitRangesAtEnd(ranges, 7*24*60*60);
	}
	else
	{
		var validDays= [1,1,1,1,1,1,1];
		var hourRanges = [];
		if(days != "")
		{
			validDays= [0,0,0,0,0,0,0];
			var splitDays = days.split(/[\t ]*,[\t ]*/);
			var dayIndex;
			for(dayIndex=0; dayIndex < splitDays.length; dayIndex++)
			{
				var dayName = (splitDays[dayIndex]).substr(0,3).toUpperCase();
				if(dayToIndex[dayName] != null)
				{
					validDays[ dayToIndex[dayName] ] = 1;
				}
			}
		}
		if(hours != "")
		{
			var parsePiece = function(piece)
			{
				var splitPiece = piece.split(/[:\t ]+/);
				splitPiece[0] = parsePaddedInt(splitPiece[0]) + "" != "NaN" ? parsePaddedInt(splitPiece[0])*60*60 : 0;
				splitPiece[1] = parsePaddedInt(splitPiece[1]) + "" != "NaN" ? parsePaddedInt(splitPiece[1])*60 : 0;
				splitPiece[2] = splitPiece[2] != null ? ( parsePaddedInt(splitPiece[2]) + "" != "NaN" ? parsePaddedInt(splitPiece[2]) : 0) : 0;


				return splitPiece[0] + splitPiece[1] + splitPiece[2]; 
			}
			var pairs = hours.split(/[\t ]*,[\t ]*/);
			var pairIndex;
			for(pairIndex=0; pairIndex < pairs.length; pairIndex++)
			{
				var pieces = (pairs[pairIndex]).split(/[\t ]*\-[\t ]*/);
				hourRanges.push(parsePiece(pieces[0]));
				hourRanges.push(parsePiece(pieces[1]));
			}
			hourRanges = splitRangesAtEnd(hourRanges, 24*60*60);
		}
		hourRanges = hourRanges.length == 0 ? [0,24*60*60] : hourRanges;

		var dayIndex;
		for(dayIndex=0; dayIndex < validDays.length; dayIndex++)
		{
			if(validDays[dayIndex] != 0)
			{
				var hourIndex;
				for(hourIndex=0; hourIndex < hourRanges.length; hourIndex++)
				{
					ranges.push( (dayIndex*24*60*60) + hourRanges[hourIndex] )
				}
			}
		}
	}

	if(invert)
	{
		if(ranges[0] == 0)
		{
			ranges.shift();
		}
		else
		{
			ranges.unshift(0);
		}

		if(ranges[ ranges.length-1 ] == 7*24*60*60)
		{
			ranges.pop();
		}
		else
		{
			ranges.push(7*24*60*60);
		}
	}
	return ranges;
}


function rangesOverlap(t1, t2)
{
	var ranges1 = timeVariablesToWeeklyRanges(t1[0], t1[1], t1[2], t1[3]);
	var ranges2 = timeVariablesToWeeklyRanges(t2[0], t2[1], t2[2], t2[3]);

	
	var r1Index = 0;
	var r2Index = 0;
	var overlapFound = false;
	for(r1Index=0; r1Index < ranges1.length && (!overlapFound); r1Index=r1Index+2)
	{
		var r1Start = ranges1[r1Index];
		var r1End   = ranges1[r1Index+1];
		var r2Start = ranges2[r2Index];
		var r2End   = ranges2[r2Index+1];
		overlapFound = overlapFound || (r1End > r2Start && r1Start < r2End);

		while( (!overlapFound) && r2Start < r1Start)
		{
			r2Index = r2Index+2;
			var r2Start = ranges2[r2Index];
			var r2End   = ranges2[r2Index+1];
			overlapFound = overlapFound || (r1End > r2Start && r1Start < r2End);
		}
	}
	return overlapFound;
}



function validateQuota(controlDocument, originalQuotaId, originalQuotaIp)
{
	originalQuotaId = originalQuotaId == null ? "" : originalQuotaId;
	originalQuotaIp = originalQuotaIp == null ? "none" : originalQuotaIp; //null is not the same as "" -- the latter gets interpretted as "ALL"

	controlDocument = controlDocument == null ? document : controlDocument;
	var inputIds = ["applies_to", "max_up", "max_down", "max_combined", "offpeak_hours"];
	var labelIds = ["applies_to_label", "max_up_label", "max_down_label", "max_combined_label", "quota_active_label"];
	var functions = [validateIP, validateDecimal, validateDecimal, validateDecimal, validateHours];
	var validReturnCodes = [0,0,0,0,0];
	var visibilityIds = ["applies_to", "max_up_container","max_down_container","max_combined_container", "offpeak_hours_container"];
	var errors = proofreadFields(inputIds, labelIds, functions, validReturnCodes, visibilityIds, controlDocument );

	//also validate 1) up,down,total aren't all unlimited 2)any quota with overlapping ips doesn't have overlapping time ranges
	if(errors.length == 0)
	{
		if( 	getSelectedValue("max_up_type", controlDocument) == "unlimited" && 
			getSelectedValue("max_down_type", controlDocument) == "unlimited" && 
			getSelectedValue("max_combined_type", controlDocument) == "unlimited"
			)
		{
			errors.push("Upload, download and combined bandwidth limits cannot all be unlimited");
		}
	}
	if(errors.length == 0)
	{
		var ip = getIpFromDocument(controlDocument);'
		if(ip != originalQuotaIp)
		{
			var quotaSections = uci.getAllSectionsOfType(pkg, "quota");
			var sectionIndex;
			var overlapFound = false;
			for(sectionIndex=0; sectionIndex < quotaSections.length && (!overlapFound); sectionIndex++)
			{
				var sectionId = uci.get(pkg, quotaSections[sectionIndex], "id");
				if(sectionId != originalQuotaId)
				{
					var sectionIp = uci.get(pkg, quotaSections[sectionIndex], "ip");
					var ipOverlap = testIpOverlap(sectionIp, ip);
					if(ipOverlap)
					{
						//test time range overlap
						var sectionTime = getTimeParametersFromDocument(controlDocument);
						var testTime = getTimeParametersFromUci(uci, quotaSections[sectionIndex);
						sectionTime[3] = sectionTime[3] == "except" ? true : false;
						testTime[3] = testTime[3] == "except" ? true : false;
						overlapFound = rangesOverlap(sectionTime[0], sectionTime[1], sectionTime[2]
					}
				}
			}
			
			if(ovelapFound)
			{	
				if(!ip.match(/ALL/))
				{
					errors.push("Duplicate IP/Time Range -- only one quota per IP at a given time is allowed");
				}
				else if(ip.match(/OTHER/))
				{
					errors.push("You may have only one quota at a given time for hosts without explicit quotas");
				}
				else
				{
					errors.push("You may have only one quota at a given time that applies to entire network");
				}
			}
		}
	}
	return errors;
}

function setDocumentFromUci(controlDocument, srcUci, id)
{
	controlDocument = controlDocument == null ? document : controlDocument;
	

	var quotaSection = "";
	var sections = srcUci.getAllSectionsOfType(pkg, "quota");
	for(sectionIndex=0; sectionIndex < sections.length; sectionIndex++)
	{
		if(srcUci.get(pkg, sections[sectionIndex], "id") == id )
		{
			quotaSection = sections[sectionIndex];
		}
	}

	var ip = srcUci.get(pkg, sections[sectionIndex], "ip");
	ip = ip == "" ? "ALL" : ip;

	var resetInterval = srcUci.get(pkg, quotaSection, "reset_interval");
	var uploadLimit = srcUci.get(pkg, quotaSection, "egress_limit");
	var downloadLimit = srcUci.get(pkg, quotaSection, "ingress_limit");
	var combinedLimit = srcUci.get(pkg, quotaSection, "combined_limit");
	resetInterval = resetInterval == "" || resetInterval == "minute" ? "day" : resetInterval;
	var offset = srcUci.get(pkg, quotaSection, "reset_time");
	offset = offset == "" ? 0 : parseInt(offset);
	var resetDay = getDaySeconds(offset);
	var resetHour = getHourSeconds(offset);

	setDocumentIp(ip, controlDocument);
	setSelectedValue("quota_reset", resetInterval, controlDocument);



	var timeParameters = getTimeParametersFromUci(srcUci, quotaSection);
	var days = timeParameters[1];

	var allDays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
	var dayList = [];
	if(days == "")
	{
		dayList = allDays;
	}
	else
	{
		dayList = days.split(/,/);
	}
	var dayIndex=0;
	for(dayIndex = 0; dayIndex < allDays.length; dayIndex++)
	{
		var nextDay = allDays[dayIndex];
		var dayFound = false;
		var testIndex=0;
		for(testIndex=0; testIndex < dayList.length && !dayFound; testIndex++)
		{
			dayFound = dayList[testIndex] == nextDay;
		}
		controlDocument.getElementById("quota_" + allDays[dayIndex]).checked = dayFound;
	}

	controlDocument.getElementById("active_hours_container").value = timeParameters[0];
	controlDocument.getElementById("active_weekly_container").value = timeParameters[2];

	var active = timeParameters[3];
	setSelectedValue("quota_active", active, controlDocument);
	if(active != "always")
	{
		var activeTypes = [];
		activeTypes["000"] = "hours";
		activeTypes["100"] = "hours";
		activeTypes["010"] = "days";
		activeTypes["110"] = "days_and_hours";
		var activeTypeId = (hours != "" ? "1" : "0") + (days != "" ? "1" : "0") + (weekly == "" ? "0" : "1");
		var activeType = activeTypes[activeTypeId] != null ? activeTypes[activeTypeId] : "weekly_range";
		setSelectedValue("quota_active_type", activeType, controlDocument);
	}
	

	setSelectedValue("max_up_type", uploadLimit == "" ? "unlimited" : "limited", controlDocument );
	setSelectedValue("max_down_type", downloadLimit == "" ? "unlimited" : "limited", controlDocument );
	setSelectedValue("max_combined_type", combinedLimit == "" ? "unlimited" : "limited", controlDocument );

	
	setDocumentLimit(uploadLimit,   "max_up",       "max_up_unit", controlDocument);
	setDocumentLimit(downloadLimit, "max_down",     "max_down_unit", controlDocument);
	setDocumentLimit(combinedLimit, "max_combined", "max_combined_unit", controlDocument);

	setVisibility(controlDocument);
	setSelectedValue("quota_day", resetDay + "", controlDocument);
	setSelectedValue("quota_hour", resetHour + "", controlDocument);
}

function setDocumentLimit(bytes, text_id, unit_select_id, controlDocument)
{
	bytes = bytes == "" ? 0 : parseInt(bytes);
	var textEl = controlDocument.getElementById(text_id);
	if(bytes <= 0)
	{
		setSelectedValue(unit_select_id, "MB", controlDocument);
		textEl.value = "0";
	}
	else
	{
		var pb = parseBytes(bytes);
		var unit = "MB";
		var multiple = 1024*1024;
		if(pb.match(/GBytes/)) { unit = "GB"; multiple = 1024*1024*1024; };
		if(pb.match(/TBytes/)) { unit = "TB"; multiple = 1024*1024*1024*1024; };
		setSelectedValue(unit_select_id, unit, controlDocument);
		var adjustedVal = truncateDecimal(bytes/multiple);
		textEl.value = adjustedVal;
	}
}

function setUciFromDocument(controlDocument, id)
{
	controlDocument = controlDocument == null ? document : controlDocument;
	
	var ip = getIpFromDocument(controlDocument);

	id = id == null ? "" : id;
	id = id == "" ? getIdFromIp(ip) : id;

	var quotaSection = "";
	var sections = uci.getAllSectionsOfType(pkg, "quota");
	for(sectionIndex=0; sectionIndex < sections.length; sectionIndex++)
	{
		if(uci.get(pkg, sections[sectionIndex], "id") == id)
		{
			quotaSection = sections[sectionIndex];
		}
	}
	if(quotaSection == "")
	{
		var quotaNum = 1;
		while( uci.get(pkg, "quota_" + quotaNum, "") != "") { quotaNum++; }
		quotaSection = "quota_" + quotaNum;
		uci.set(pkg, quotaSection, "", "quota");
	}

	var oldIp = uci.get(pkg, quotaSection, "ip");
	if(oldIp != ip)
	{
		changedIds[ip] = 1;
	}

	
	uci.set(pkg, quotaSection, "ingress_limit",  getDocumentLimit("max_down", "max_down_type", "max_down_unit", controlDocument)  );
	uci.set(pkg, quotaSection, "egress_limit",   getDocumentLimit("max_up", "max_up_type", "max_up_unit", controlDocument) );
	uci.set(pkg, quotaSection, "combined_limit", getDocumentLimit("max_combined", "max_combined_type", "max_combined_unit", controlDocument) );
	uci.set(pkg, quotaSection, "reset_interval", getSelectedValue("quota_reset", controlDocument));
	uci.set(pkg, quotaSection, "ip", ip);
	uci.set(pkg, quotaSection, "id", id);

	var qd = getSelectedValue("quota_day", controlDocument);
	var qh = getSelectedValue("quota_hour", controlDocument);
	qd = qd == "" ? "0" : qd;
	qh = qh == "" ? "0" : qh;
	var resetTime= parseInt(qd) + parseInt(qh);
	if(resetTime > 0)
	{
		var resetTimeStr = resetTime + "";
		uci.set(pkg, quotaSection, "reset_time", resetTimeStr);
	}
	else
	{
		uci.remove(pkg, quotaSection, "reset_time");
	}


	var timeParameters = getTimeParametersFromDocument(controlDocument);
	var active = timeParameters[3];
	var onoff = ["offpeak", "onpeak"];
	var onoffIndex = 0;
	for(onoffIndex=0; onoffIndex < onoff.length; onofIndex++)
	{
		var prefix = onoff[onoffIndex];
		var updateFun = function(prefixActive,option,val)
		{ 
			if(prefixActive)
			{
				uci.set(pkg,quotaSection,option,val); 
			}
			else
			{
				uci.remove(pkg,quotaSection,option);
			}
		}
		var prefixActive = (prefix == "offpeak" && active == "except") || (prefix == "onpeak" && active == "only");
		updateFun(prefixActive, prefix + "_hours", timeParameters[0]);
		updateFun(prefixActive, prefix + "_weekdays", timeParameters[1]);
		updateFun(prefixActive, prefix + "_weekly_ranges", timeParameters[2]);
	}
}

function getTimeParametersFromDocument(controlDocument)
{
	var hours = controlDocument.getElementById("active_hours_container").style.display != "none" ? controlDocument.getElementById("active_hours").value : "";
	var weekly = controlDocument.getElementById("active_weekly_container").style.display != "none" ? controlDocument.getElementById("active_weekly").value : "";
	
	var dayList = [];
	if(controlDocument.getElementById("active_days_container").style.display != "none")
	{
		var allDays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
		var dayIndex;
		for(dayIndex=0; dayIndex < allDays.length; dayIndex++)
		{
			if( controlDocument.getElementById("quota_" + allDays[dayIndex]).checked )
			{
				dayList.push( allDays[dayIndex]);
			}
		}
	}
	var days = "" + dayList.join(",");

	var active = getSelectedValue("quota_active", controlDocument);
	
	return [hours,days,weekly,active];

}
function getTimeParametersFromUci(srcUci, quotaSection)
{
	var hours = srcUci.get(pkg, quotaSection, "offpeak_hours");
	var days = srcUci.get(pkg, quotaSection, "offpeak_weekdays");
	var weekly = srcUci.get(pkg, quotaSection, "offpeak_weekly_ranges");
	var active = hours != "" || days != "" || weekly != "" ? "except" : "always";
	if(active == "always")
	{
		hours = srcUci.get(pkg, quotaSection, "onpeak_hours");
		days = srcUci.get(pkg, quotaSection, "onpeak_weekdays");
		weekly = srcUci.get(pkg, quotaSection, "onpeak_weekly_ranges");
		active = hours != "" || days != "" || weekly != "" ? "only" : "always";

	}
	return [hours,days,weekly,active];
}


/* returns a number if there is a limit "" if no limit defined */
function getDocumentLimit(text_id, unlimited_select_id, unit_select_id, controlDocument)
{
	var ret = "";
	if(getSelectedValue(unlimited_select_id, controlDocument) != "unlimited")
	{
		var unit = getSelectedValue(unit_select_id, controlDocument);
		var multiple = 1024*1024;
		if(unit == "MB") { multiple = 1024*1024; }
		if(unit == "GB") { multiple = 1024*1024*1024; }
		if(unit == "TB") { multiple = 1024*1024*1024*1024; }
		var bytes = Math.round(multiple * parseFloat(controlDocument.getElementById(text_id).value));
		ret =  "" + bytes;
	}
	return ret;
}

function createEnabledCheckbox(enabled)
{
	enabledCheckbox = createInput('checkbox');
	enabledCheckbox.onclick = setRowEnabled;
	enabledCheckbox.checked = enabled;
	return enabledCheckbox;
}

function createEditButton(enabled)
{
	editButton = createInput("button");
	editButton.value = "Edit";
	editButton.className="default_button";
	editButton.onclick = editQuota;
	
	editButton.className = enabled ? "default_button" : "default_button_disabled" ;
	editButton.disabled  = enabled ? false : true;

	return editButton;
}
function setRowEnabled()
{
	enabled= this.checked ? "1" : "0";
	enabledRow=this.parentNode.parentNode;

	enabledRow.childNodes[5].firstChild.disabled  = this.checked ? false : true;
	enabledRow.childNodes[5].firstChild.className = this.checked ? "default_button" : "default_button_disabled" ;

	var idStr = this.id;
	var ids = idStr.split(/\./);
	if(uci.get(pkg, ids[0]) != "")
	{
		uci.set(pkg, ids[0], "enabled", enabled);
	}
	if(uci.get(pkg, ids[1]) != "")
	{
		uci.set(pkg, ids[1], "enabled", enabled);
	}
}
function removeQuotaCallback(table, row)
{
	var id = row.childNodes[4].firstChild.id;
	uci.removeSection(pkg, id);
	changedIds [ row.childNodes[0].firstChild.data.replace(/ /g, "_") ] = 1;
}

function editQuota()
{
	if( typeof(editQuotaWindow) != "undefined" )
	{
		//opera keeps object around after
		//window is closed, so we need to deal
		//with error condition
		try
		{
			editQuotaWindow.close();
		}
		catch(e){}
	}

	
	try
	{
		xCoor = window.screenX + 225;
		yCoor = window.screenY+ 225;
	}
	catch(e)
	{
		xCoor = window.left + 225;
		yCoor = window.top + 225;
	}


	editQuotaWindow = window.open("quotas_edit.sh", "edit", "width=560,height=600,left=" + xCoor + ",top=" + yCoor );
	
	var saveButton = createInput("button", editQuotaWindow.document);
	var closeButton = createInput("button", editQuotaWindow.document);
	saveButton.value = "Close and Apply Changes";
	saveButton.className = "default_button";
	closeButton.value = "Close and Discard Changes";
	closeButton.className = "default_button";

	var editRow=this.parentNode.parentNode;
	var editId          = editRow.childNodes[4].firstChild.id;
	var editUpPrc       = editRow.childNodes[1].firstChild.data.replace(/%/g, "");
	var editDownPrc     = editRow.childNodes[2].firstChild.data.replace(/%/g, "");
	var editCombinedPrc = editRow.childNodes[3].firstChild.data.replace(/%/g, "");
	var editIp;

	var editSection = "";
	var sections = uci.getAllSectionsOfType(pkg, "quota");
	for(sectionIndex=0; sectionIndex < sections.length && editSection == ""; sectionIndex++)
	{
		if(uci.get(pkg, sections[sectionIndex], "id") == editId)
		{
			editSection = sections[sectionIndex];
			editIp = uci.get(pkg, editSection, "ip");
		}
	}

	var editUpMax       = uci.get(pkg, editSection, "egress_limit");
	var editDownMax     = uci.get(pkg, editSection, "ingress_limit");
	var editCombinedMax = uci.get(pkg, editSection, "combined_limit");

	var runOnEditorLoaded = function () 
	{
		var updateDone=false;
		if(editQuotaWindow.document != null)
		{
			if(editQuotaWindow.document.getElementById("bottom_button_container") != null)
			{
				editQuotaWindow.document.getElementById("bottom_button_container").appendChild(saveButton);
				editQuotaWindow.document.getElementById("bottom_button_container").appendChild(closeButton);
				setDocumentFromUci(editQuotaWindow.document, uci, editId);

				closeButton.onclick = function()
				{
					editQuotaWindow.close();
				}
				saveButton.onclick = function()
				{
					// error checking goes here
					var errors = validateQuota(editQuotaWindow.document, editId, editIp);
					if(errors.length > 0)
					{
						alert(errors.join("\n") + "\nCould not add quota.");
					}
					else
					{
						var newIp = getIpFromDocument(editQuotaWindow.document);
						setUciFromDocument(editQuotaWindow.document, editId);

						if(newIp != editIp)
						{
							changedIds[editId] = 1;
							var newId = getIdFromIp(newIp);
							uci.set(pkg, editSection, "id", newId);
							changedIds[newId] = 1;

							editRow.childNodes[0].firstChild.data = newIp.replace(/_/g, " ");
							editRow.childNodes[1].firstChild.data = uci.get(pkg, editSection, "egress_limit") == "" ? "N/A" : "0%";
							editRow.childNodes[2].firstChild.data = uci.get(pkg, editSection, "ingress_limit") == "" ? "N/A" : "0%";
							editRow.childNodes[3].firstChild.data = uci.get(pkg, editSection, "combined_limit") == "" ? "N/A" : "0%";
							editRow.childNodes[4].firstChild.id = editId;
						}
						else
						{
							var adjustPercent = function(usedOptionIndex, newMaxStr)
							{
								var oldUsedQ = quotaUsed[newIp];
								var newPercent = "0";
								if(oldUsedQ != null)
								{
									var oldUsed = oldUsedQ[usedOptionIndex];
									oldUsed = oldUsed == "" ? 0 : parseInt(oldUsed);
									var limit = parseFloat(newMaxStr)*1024.0*1024.0;
									newPercent =  Math.round((oldUsed*100*1000)/(limit))/1000 ;
								}
								return newPercent + "%";
							}

							var upMax   = editQuotaWindow.document.getElementById("max_up").value;
							var downMax = editQuotaWindow.document.getElementById("max_down").value;
							var combinedMax = editQuotaWindow.document.getElementById("max_combined").value;
							var useUpMax = getSelectedValue("max_up_type", editQuotaWindow.document) != "unlimited";
							var useDownMax = getSelectedValue("max_down_type", editQuotaWindow.document) != "unlimited";
							var useCombinedMax = getSelectedValue("max_combined_type", editQuotaWindow.document) != "unlimited";
							
							editRow.childNodes[1].firstChild.data = useUpMax   ? adjustPercent(0, upMax) : "N/A";
							editRow.childNodes[2].firstChild.data = useDownMax   ? adjustPercent(1, downMax) : "N/A";
							editRow.childNodes[3].firstChild.data = useCombinedMax  ? adjustPercent(2, combinedMax) : "N/A";

						}
						
						editQuotaWindow.close();
					}
				}
				editQuotaWindow.moveTo(xCoor,yCoor);
				editQuotaWindow.focus();
				updateDone = true;
				
			}
		}
		if(!updateDone)
		{
			setTimeout(runOnEditorLoaded, 250);
		}
	}
	runOnEditorLoaded();
}
