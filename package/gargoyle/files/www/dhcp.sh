#!/usr/bin/haserl
<?
	# This program is copyright � 2008 Eric Bishop and is distributed under the terms of the GNU GPL 
	# version 2.0 with a special clarification/exception that permits adapting the program to 
	# configure proprietary "back end" software provided that all modifications to the web interface
	# itself remain covered by the GPL. 
	# See http://gargoyle-router.com/faq.html#qfoss for more information
	
	gargoyle_header_footer -h -s "connection" -p "dhcp" -c "internal.css" -j "table.js dhcp.js" network wireless dhcp
	subnet=$(ifconfig br-lan | awk 'BEGIN {FS=":"}; $0 ~ /inet.addr/ {print $2}' | awk 'BEGIN {FS="."}; {print $1"\."$2"\."$3"\."}')
?>

<script>
<!--
<?
	echo "var subnet=\"$subnet\";"
	echo "var dhcpSection = getDhcpSection(uciOriginal);"
	
	if [ -h /etc/rc.d/*dnsmasq* ] ; then
		echo "var dhcpEnabled = true;"
	else
		echo "var dhcpEnabled = false;"
	fi

	echo "var hostData = new Array();"
	if [ -e /etc/hosts ]
	then
		cat /etc/hosts | awk ' $0 ~ /^[\t ]*[0-9]/ {print "hostData.push([\""$1"\",\""$2"\"]);"};'
	fi

	echo "";
	echo "var etherData = new Array();";
	if [ -e /etc/ethers ]
	then
		cat /etc/ethers | awk ' $0 ~ /^[\t ]*[0-9]/ {print "etherData.push([\""$1"\",\""$2"\"]);"};'

	fi

?>

var ipHostHash = new Array();
for (hostIndex in hostData)
{
	host=hostData[hostIndex];
	ipHostHash[ host[0] ] = host[1];
}

var staticIpTableData = new Array();
for (etherIndex in etherData)
{
	ether=etherData[etherIndex];
	mac=ether[0].toLowerCase();
	ip=ether[1];
	host= ipHostHash[ip] == null ? '-' : ipHostHash[ip];
	staticIpTableData.push([host, mac, ip]);
}

//-->
</script>


<form>
	<fieldset>
		<legend class="sectionheader">DHCP</legend>


		<div id='dhcp_enabled_container'>
			<div class='nocolumn'>
				<input type='checkbox' id='dhcp_enabled' onclick="setEnabled(this.checked)" />
				<label id='dhcp_enabled_label' for='dhcp_enabled'>LAN DHCP Server Enabled</label>
			</div>
		</div>


		<div id='dhcp_range_container'>
			<label class='nocolumn' for='dhcp_start'>DHCP range:</label>
		</div>
		<div id='dhcp_start_container' class='indent'>
			<label class='leftcolumn' for='dhcp_start' id='dhcp_start_label'>Start:</label>
			<span class='rightcolumn'><? echo -n "$subnet" ?></span>
			<input type='text' class='rightcolumn' id='dhcp_start' onkeyup='proofreadNumeric(this)' size='5' maxlength='3' />
		</div>
		<div id='dhcp_end_container' class='indent'>
			<label class='leftcolumn' for='dhcp_end' id='dhcp_end_label'>End:</label>
			<span class='rightcolumn'><? echo -n "$subnet" ?></span>
			<input type='text' class='rightcolumn' id='dhcp_end' onkeyup='proofreadNumeric(this)' size='5' maxlength='3' />
		</div>
		<div id='dhcp_lease_container'>
			<label class='leftcolumn' for='dhcp_lease' id='dhcp_lease_label'>Lease Time:</label>
			<input type='text' class='rightcolumnindent' onkeyup='proofreadNumeric(this)' id='dhcp_lease' size='5' maxlength='4' />
			<em>(hours)</em>
		</div>

	</fieldset>

	<fieldset>
		<legend class="sectionheader">Static IPs</legend>



		<div id='staticip_add_heading_container'>
			<label class='nocolumn' id='staticip_add_heading_label'>Add Static IP Address:</label>
		</div>
		<div class='bottom_gap'>
			<div id='staticip_add_container'>
				<? cat templates/static_ip_template ?>
			</div>
		</div>
		
		<div id='staticip_table_heading_container'>
			<span class='nocolumn'>Assigned Static IP Addresses:</span>
		</div>
		<div class='indent'>
			<div id='staticip_table_container' class="bottom_gap"></div>
		</div>


		
	</fieldset>

	<div id="firefox3_bug_correct" style="display:none">
		<input type='text' value='firefox3_bug' />
	</div>


	<div id="bottom_button_container">
		<input type='button' value='Save Changes' id="save_button" class="bottom_button"  onclick='saveChanges()' />
		<input type='button' value='Reset' id="reset_button" class="bottom_button"  onclick='resetData()'/>
	</div>
	<span id="update_container" >Please wait while new settings are applied. . .</span>
</form>



<!-- <br /><textarea style="margin-left:20px;" rows=30 cols=60 id='output'></textarea> -->




<script>
<!--
	resetData();
//-->
</script>


<?
	gargoyle_header_footer -f -s "connection" -p "dhcp"
?>
