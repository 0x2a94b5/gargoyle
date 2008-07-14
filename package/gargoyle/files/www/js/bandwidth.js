/*
 * This program is copyright 2008 Eric Bishop and is distributed under the terms of the GNU GPL 
 * version 2.0 with a special clarification/exception that permits adapting the program to 
 * configure proprietary "back end" software provided that all modifications to the web interface
 * itself remain covered by the GPL. 
 * See http://gargoyle-router.com/faq.html#qfoss for more information
 */
var ipMonitorIds;
var qosUploadMonitorIds;
var qosDownloadMonitorIds;


var uploadMonitors;
var downloadMonitors;
var updateInProgress;
var graphType;

var dailyUploadData;
var dailyDownloadData;

var updateUploadPlot = null;
var updateDownloadPlot = null;

function initializePlotsAndTable()
{
	// we are going to assume we know what graph types (i.e. time frames) are available for each
	// type of monitor.  We might want to go back and make this configurable somehow later
	// by parameterizing the init script but this gets complicated and ugly really fast
	// so for now we assume all 4 types for total and 2 for the others (15h & 15d)
	
	ipMonitorIds = new Array();
	qosUploadMonitorIds = new Array();
	qosDownloadMonitorIds = new Array();


	definedIpIds = new Array();
	definedUploadIds = new Array();
	definedDownloadIds = new Array();
	
	for(monitorIndex=0; monitorIndex < monitorNames.length; monitorIndex++)
	{
		if(monitorNames[monitorIndex].match(/^[0-9]+\./))
		{
			ip=monitorNames[monitorIndex].split(/-/)[0];
			if(definedIpIds[ip] == null)
			{
				definedIpIds[ip] = 1;
				ipMonitorIds.push(ip);
			}
		}
		else if(monitorNames[monitorIndex].match(/^qos\-upload\-/))
		{
			classId=monitorNames[monitorIndex].match(/os\-upload\-(.*)-[^\-]+$/)[1];
			if(definedUploadIds[classId] == null)
			{
				definedUploadIds[classId] = 1;
				qosUploadMonitorIds.push(classId);
			}
		}
		else if(monitorNames[monitorIndex].match(/^qos\-download\-/))
		{
			classId=monitorNames[monitorIndex].match(/os\-download\-(.*)-[^\-]+$/)[1];
			if(definedDownloadIds[classId] == null)
			{
				definedDownloadIds[classId] = 1;
				qosDownloadMonitorIds.push(classId);
			}
		}
	}
	if(ipMonitorIds.length > 0)
	{
		addOptionToSelectElement("plot1_type", "Static IP", "ip");
		addOptionToSelectElement("plot2_type", "Static IP", "ip");
		addOptionToSelectElement("plot3_type", "Static IP", "ip");
	}
	if(qosUploadMonitorIds.length > 0)
	{
		addOptionToSelectElement("plot1_type", "QoS Upload Class", "qos-upload");
		addOptionToSelectElement("plot2_type", "QoS Upload Class", "qos-upload");
		addOptionToSelectElement("plot3_type", "QoS Upload Class", "qos-upload");
	}
	if(qosDownloadMonitorIds.length > 0)
	{
		addOptionToSelectElement("plot1_type", "QoS Download Class", "qos-download");
		addOptionToSelectElement("plot2_type", "QoS Download Class", "qos-download");
		addOptionToSelectElement("plot3_type", "QoS Download Class", "qos-download");
	}
	setSelectedValue("time_frame", "15m");
	setSelectedValue("plot1_type", "total");
	setSelectedValue("plot2_type", "none");
	setSelectedValue("plot3_type", "none");



	uploadMonitors = ["","",""];
	downloadMonitors = ["","",""];
	updateInProgress = false;
	resetPlots();
	setInterval( 'doUpdate()', 2000);


	//setup table
	var param = getParameterDefinition("monitor", "total-upload-1y  total-download-1y" );
	var stateChangeFunction = function(dailyReq)
	{
		var monitors=null;
		if(dailyReq.readyState == 4)
		{
			monitors = parseMonitors(dailyReq.responseText);
			if(monitors["total-upload-1y"] != null)
			{
				document.getElementById("total_bandwidth_use").style.display="block";
				addOptionToSelectElement("total_time_frame", "Daily", "daily"); 
				addOptionToSelectElement("total_time_frame", "Monthly", "monthly");
				setSelectedValue("total_time_frame", "daily");
				
				dailyUploadData=monitors["total-upload-1y"];
				dailyDownloadData=monitors["total-download-1y"];
				updateTotalTable();
			}
		}
	}
	runAjax("POST", "utility/load_bandwidth.sh", param, stateChangeFunction);
}


function getEmbeddedSvgPlotFunction(embeddedId)
{
	windowElement = getEmbeddedSvgWindow(embeddedId);
	if( windowElement != null)
	{
		return windowElement.plotAll;
	}
	return null;
}


function updateTotalTable()
{
	selectedTotalTimeFrame=getSelectedValue("total_time_frame");
	totalTableData = new Array();
	columnNames = columnNames = ["", "Total Upload Bandwidth", "Total Download Bandwidth"];
	if(selectedTotalTimeFrame == "daily")
	{
		columnNames[0] = "Date";
		nextDate=new Date();
		nextDate.setTime((dailyUploadData[1]*1000)-(60*60*1000)); //this is end time point so subtract one hour so it is 11pm on day we have bandwidth for
		

		
		for(dailyIndex=dailyUploadData[0].length-1; dailyIndex >=0; dailyIndex--)
		{
			dailyUploadData[0][dailyIndex] = dailyUploadData[0][dailyIndex] > 0 ? 1.0*dailyUploadData[0][dailyIndex] : 0.0;
			dailyDownloadData[0][dailyIndex] = dailyDownloadData[0][dailyIndex] > 0 ? 1.0*dailyDownloadData[0][dailyIndex] : 0.0;

			totalTableData.push([ (nextDate.getMonth()+1)+ "/" +nextDate.getDate() + "/" + nextDate.getFullYear() , parseBytes(dailyUploadData[0][dailyIndex]), parseBytes(dailyDownloadData[0][dailyIndex]) ]);
			newTime = nextDate.getTime() - (24*60*60*1000);
			nextDate.setTime(newTime);
		}
	}
	else if(selectedTotalTimeFrame == "monthly")
	{
		columnNames[0] = "Month";
		monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
		nextDate=new Date();
		nextDate.setTime((dailyUploadData[1]*1000)-(60*60*1000)); //this is end time point so subtract one hour so it is 11pm on day we have bandwidth for
		dailyIndex = dailyUploadData[0].length-1;
		while( dailyIndex >= 0 )
		{
			//make sums floating points to deal with 64bit / 32bit conversion which can be an issue
			dailyUploadData[0][dailyIndex] = dailyUploadData[0][dailyIndex] > 0 ? 1.0*dailyUploadData[0][dailyIndex] : 0.0;
			dailyDownloadData[0][dailyIndex] = dailyDownloadData[0][dailyIndex] > 0 ? 1.0*dailyDownloadData[0][dailyIndex] : 0.0;
			monthUploadSum = dailyUploadData[0][dailyIndex];
			monthDownloadSum = dailyDownloadData[0][dailyIndex];
			month = nextDate.getMonth();
			year = nextDate.getFullYear();
			newTime = nextDate.getTime() - (24*60*60*1000);
			nextDate.setTime(newTime);
			dailyIndex--;
			while(nextDate.getMonth() == month &&  dailyIndex >= 0)
			{
				dailyUploadData[0][dailyIndex] = dailyUploadData[0][dailyIndex] > 0 ? 1.0*dailyUploadData[0][dailyIndex] : 0.0;
				dailyDownloadData[0][dailyIndex] = dailyDownloadData[0][dailyIndex] > 0 ? 1.0*dailyDownloadData[0][dailyIndex] : 0.0;

				monthUploadSum = monthUploadSum + dailyUploadData[0][dailyIndex];
				monthDownloadSum = monthDownloadSum + dailyDownloadData[0][dailyIndex];

				newTime = nextDate.getTime() - (24*60*60*1000);
				nextDate.setTime(newTime);
				dailyIndex--;
			}
			totalTableData.push([ monthNames[month] + " " + year, parseBytes(monthUploadSum), parseBytes(monthDownloadSum) ]);
		}
	}
	totalTable=createTable(columnNames, totalTableData, "total_bandwidth_table", false, false);
	tableContainer = document.getElementById('total_bandwidth_table_container');
	if(tableContainer.firstChild != null)
	{
		tableContainer.removeChild(tableContainer.firstChild);
	}
	tableContainer.appendChild(totalTable);
}

function parseBytes(bytes)
{
	var parsed;
	if(bytes > 1024*1024*1024*1024)
	{
		parsed = truncateDecimal(bytes/(1024*1024*1024*1024)) + " TBytes";
	}
	else if(bytes > 1024*1024*1024)
	{
		parsed = truncateDecimal(bytes/(1024*1024*1024)) + " GBytes";
	}
	else if(bytes > 1024*1024)
	{
		parsed = truncateDecimal(bytes/(1024*1024)) + " MBytes";
	}
	else
	{
		parsed = truncateDecimal(bytes/(1024)) + " KBytes";
	}
	return parsed;
}

function truncateDecimal(dec)
{
	result = "" + ((Math.floor(dec*1000))/1000);
	
	//make sure we have exactly three decimal places so 
	//results line up properly in table presentation
	decMatch=result.match(/.*\.(.*)$/);
	if(decMatch == null)
	{
		result = result + ".000"
	}
	else 
	{
		if(decMatch[1].length==1)
		{
			result = result + "00";
		}
		else if(decMatch[1].length==2)
		{
			result = result + "0";
		}
	}
	return result;
}


function resetPlots()
{
	if(!updateInProgress && updateUploadPlot != null && updateDownloadPlot != null)
	{
		oldUploadMonitors = uploadMonitors.join("\n");		
		oldDownloadMonitors = downloadMonitors.join("\n");		

		graphType = getSelectedValue("time_frame");
		if(graphType == "1y" || (ipMonitorIds.length == 0 && qosUploadMonitorIds.length == 0 && qosDownloadMonitorIds.length == 0))
		{
			//monitors only available for total bandwidth for this time frame
			uploadMonitors   = ["total-upload-" + graphType , "", ""];
			downloadMonitors = ["total-download-" + graphType, "", ""];
	
			//disable control columns
			document.getElementById("control_column_container").style.display="none";
			setSelectedValue("plot1_type", "total");
			setSelectedValue("plot2_type", "none");
			setSelectedValue("plot3_type", "none");
		}
		else
		{
			//enable control columns
			document.getElementById("control_column_container").style.display="block";
		
				
			for(plotNum=1; plotNum<=3; plotNum++)
			{
				type = getSelectedValue("plot" + plotNum + "_type");
				idElementName = "plot" + plotNum + "_id";
				selectedId= getSelectedValue(idElementName);
				selectedId = selectedId == null ? "" : selectedId;

				if(type == "total")
				{
					uploadMonitors[plotNum-1] = "total-upload-" + graphType;
					downloadMonitors[plotNum-1] = "total-download-" + graphType;
					document.getElementById(idElementName).style.display="none";
				}
				else if(type == "ip")
				{
					if(selectedId.match(/^[0-9]+\./) == null)
					{
						removeAllOptionsFromSelectElement(document.getElementById(idElementName));
						for(ipIndex=0; ipIndex < ipMonitorIds.length; ipIndex++)
						{
							addOptionToSelectElement(idElementName, ipMonitorIds[ipIndex], ipMonitorIds[ipIndex]);
						}
						setSelectedText(idElementName, ipMonitorIds[0]);
						selectedId = ipMonitorIds[0];
					}
					uploadMonitors[plotNum-1] =  selectedId + "-upload-" + graphType;
					downloadMonitors[plotNum-1] = selectedId + "-download-" + graphType;
					document.getElementById(idElementName).style.display="block";
				}
				else if(type == "qos-upload")
				{
					if(selectedId.match(/^qos\-upload\-/) == null)
					{
						removeAllOptionsFromSelectElement(document.getElementById(idElementName));
						for(upIndex=0; upIndex < qosUploadMonitorIds.length; upIndex++)
						{
							upClass= qosUploadMonitorIds[upIndex];
							upName = uciOriginal.get("qos_gargoyle", upClass, "name");
							upName = upName == "" ? upClass : upName;
							addOptionToSelectElement(idElementName, upName, "qos-upload-" + upClass);
						}

					}
					uploadMonitors[plotNum-1] = getSelectedValue(idElementName) + "-" + graphType;
					downloadMonitors[plotNum-1] = "";
					document.getElementById(idElementName).style.display="block";
				}
				else if(type == "qos-download")
				{
					if(selectedId.match(/^qos\-download\-/) == null)
					{
						removeAllOptionsFromSelectElement(document.getElementById(idElementName));
						for(downIndex=0; downIndex < qosDownloadMonitorIds.length; downIndex++)
						{
							downClass= qosDownloadMonitorIds[downIndex];
							downName = uciOriginal.get("qos_gargoyle", downClass, "name");
							downName = downName == "" ? downClass : downName;
							addOptionToSelectElement(idElementName, downName, "qos-download-" + downClass);
						}

					}
					uploadMonitors[plotNum-1] = "";
					downloadMonitors[plotNum-1] = getSelectedValue(idElementName) + "-" + graphType;
					document.getElementById(idElementName).style.display="block";
				}
				else
				{
					uploadMonitors[plotNum-1] = "";
					downloadMonitors[plotNum-1] = "";
					document.getElementById(idElementName).style.display="none";
				}
			}
		}	
			
		if(oldUploadMonitors != uploadMonitors.join("\n") || oldDownloadMonitors != downloadMonitors.join("\n") )
		{
			doUpdate();
		}
	}
	else
	{
		setTimeout( "resetPlots()", 100); //try again in 100 milliseconds
		if( updateUploadPlot == null || updateDownloadPlot == null )
		{
			updateUploadPlot = getEmbeddedSvgPlotFunction("upload_plot");
			updateDownloadPlot = getEmbeddedSvgPlotFunction("download_plot");
		}
	}
}

function parseMonitors(outputData)
{
	monitors = new Array();
	dataLines = outputData.split("\n");
	for(lineIndex=0; lineIndex < dataLines.length; lineIndex++)
	{
		if(dataLines[lineIndex].length > 0)
		{
			monitorName = dataLines[lineIndex];
			lineIndex++; 
			lineIndex++; //ignore first interval start
			lineIndex++; //ignore first interval end
			lastTimePoint = dataLines[lineIndex];
			lineIndex++;
			points = dataLines[lineIndex].split(",");
			monitors[monitorName] = [points, lastTimePoint];
		}
	}
	return monitors;
}

function doUpdate()
{
	if(updateUploadPlot != null && updateDownloadPlot != null)
	{
		updateInProgress = true;

		var monitorNames = uploadMonitors.join(" ") + " " + downloadMonitors.join(" ");

		var param = getParameterDefinition("monitor", monitorNames);
		var stateChangeFunction = function(req)
		{
			var monitors=null;
			if(req.readyState == 4)
			{
				monitors = parseMonitors(req.responseText);

				var uploadMonitorPointSets = new Array();
				var downloadMonitorPointSets = new Array();
				var lastTimePoint = Math.floor( (new Date()).getTime()/1000 );
				for(monitorIndex=0; monitorIndex < uploadMonitors.length; monitorIndex++)
				{
					dataLoaded = false;
					if(uploadMonitors[monitorIndex] != "")
					{
						if(monitors[uploadMonitors[monitorIndex]] != null)
						{
							uploadMonitorPointSets.push(monitors[uploadMonitors[monitorIndex]][0]);
							lastTimePoint = monitors[uploadMonitors[monitorIndex]][1];
							dataLoaded=true;
						}
					}
					if(!dataLoaded)
					{
						uploadMonitorPointSets.push(null);
					}
				}
				for(monitorIndex=0; monitorIndex < downloadMonitors.length; monitorIndex++)
				{
					dataLoaded = false;
					if(downloadMonitors[monitorIndex] != "")
					{
						if(monitors[downloadMonitors[monitorIndex]] != null)
						{
							downloadMonitorPointSets.push(monitors[downloadMonitors[monitorIndex]][0]);
							lastTimePoint = monitors[downloadMonitors[monitorIndex]][1];
							dataLoaded=true;
						}
					}
					if(!dataLoaded)
					{
						downloadMonitorPointSets.push(null);
					}
				}
				
				updateUploadPlot(graphType, uploadMonitorPointSets, lastTimePoint );
				updateDownloadPlot(graphType, downloadMonitorPointSets, lastTimePoint );
			
				updateInProgress = false;
			}
		}
		runAjax("POST", "utility/load_bandwidth.sh", param, stateChangeFunction);
	}
}


