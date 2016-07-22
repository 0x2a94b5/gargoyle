#!/usr/bin/haserl
<%
	# This program is copyright © 2008-2013 Eric Bishop and is distributed under the terms of the GNU GPL
	# version 2.0 with a special clarification/exception that permits adapting the program to
	# configure proprietary "back end" software provided that all modifications to the web interface
	# itself remain covered by the GPL.
	# See http://gargoyle-router.com/faq.html#qfoss for more information
	eval $( gargoyle_session_validator -c "$COOKIE_hash" -e "$COOKIE_exp" -a "$HTTP_USER_AGENT" -i "$REMOTE_ADDR" -r "login.sh" -t $(uci get gargoyle.global.session_timeout) -b "$COOKIE_browser_time"  )
	gargoyle_header_footer -h -s "connection" -p "tor" -c "internal.css" -j "tor.js" -z "tor.js" tor uhttpd dropbear firewall
%>

<script>
<%
	echo "var storageDrives = [];"
	awk '{ print "storageDrives.push([\""$1"\",\""$2"\",\""$3"\",\""$4"\", \""$5"\", \""$6"\"]);" }' /tmp/mounted_usb_storage.tab 2>/dev/null

	gpkg dest-info -o 'js'
%>
</script>

<h1 class="page-header">TOR</h1>
<div class="row">

	<div class="col-lg-6">
		<div class="panel panel-default">

			<div class="panel-heading">
				<h3 class="panel-title"><%~ tor.TorAC %></h3>
			</div>

			<div class="panel-body">

				<div id='tor_client_mode_container' class="form-group">
					<label for='tor_client_mode' id='tor_client_mode_label'><%~ TorC %>:</label>
					<select class="form-control" id="tor_client_mode" onchange='setTorVisibility()' >
						<option value="2"><%~ EnByHost %></option>
						<option value="1"><%~ EnAll %></option>
						<option value="3"><%~ HidAcc %></option>
						<option value="0"><%~ Disabled %></option>
					</select>
					<em><span id="mode_description"></span></em>
				</div>

				<div id='tor_client_connect_container' class="form-group">
					<label for='tor_client_connect' id='tor_client_mode_label'><%~ ConVia %>:</label>
					<select class="form-control" id="tor_client_connect" onchange='setTorVisibility()' >
						<option value="relay"><%~ TRly %></option>
						<option value="bridge"><%~ TBrg %></option>
						<option value="obfsproxy"><%~ TBrgOb %></option>
					</select>
				</div>
				<div class="indent">
					<div id='tor_client_bridge_ip_container' class="form-group">
						<label for='tor_client_bridge_ip' id='tor_client_bridge_ip_label'><%~ BrIP %>:</label>
						<input type="text" class="form-control" id='tor_client_bridge_ip' onkeyup='proofreadIp(this)'/>
					</div>
					<div id='tor_client_bridge_port_container' class="form-group">
						<label for='tor_client_bridge_port' id='tor_client_bridge_port_label'><%~ BrPrt %>:</label>
						<input type="text" class="form-control" id='tor_client_bridge_port' onkeyup='proofreadPort(this)'/>
					</div>
				</div>

				<div id='tor_other_proto_container' class="form-group">
					<label for='tor_other_proto' id='tor_other_proto_label'><%~ OProto %>:</label>
					<select class="form-control" id="tor_other_proto">
						<option value="0"><%~ Ignr %></option>
						<option value="1"><%~ Blck %></option>
					</select>
				</div>

				<div id='tor_hidden_subnet_container' class="form-group">
					<label for='tor_hidden_subnet' id='tor_hidden_subnet_label'><%~ HSSub %>:</label>
					<input type="text" class="form-control" id='tor_hidden_subnet' onkeyup='proofreadIp(this)' />
				</div>
				<div id='tor_hidden_mask_container' class="form-group">
					<label for='tor_hidden_mask' id='tor_hidden_mask_label'><%~ HSMsk %>:</label>
					<input type="text" class="form-control" id='tor_hidden_mask' onkeyup='proofreadMask(this)' />
				</div>

			</div>

		</div>
	</div>

</div>

<div class="row">

	<div class="col-lg-6">
		<div class="panel panel-default">

			<div class="panel-heading">
				<h3 class="panel-title"><%~ TorAS %></h3>
			</div>

			<div class="panel-body">

				<div id='tor_relay_mode_container' class="form-group">
					<label for='tor_relay_mode' id='tor_relay_mode_label'><%~ TorS %>:</label>
					<select class="form-control" id="tor_relay_mode" onchange='setTorVisibility()' >
						<option value="1"><%~ EnBr %></option>
						<option value="3"><%~ EnBrO %></option>
						<option value="2"><%~ EnRly %></option>
						<option value="0"><%~ Disabled %></option>
					</select>
					<em><span id="mode_description"></span></em>
				</div>

				<div id='tor_relay_port_container' class="form-group">
					<label for='tor_relay_port' id='tor_relay_port_label'><%~ BrRPrt %>:</label>
					<input type="text" class="form-control" id='tor_relay_port' size='9' onkeyup='proofreadPort(this)' />
				</div>

				<div id='tor_obfsproxy_port_container' class="form-group">
					<label for='tor_obfsproxy_port' id='tor_obfsproxy_port_label'><%~ ObfPrt %>:</label>
					<input type="text" class="form-control" id='tor_obfsproxy_port' size='9' onkeyup='proofreadPort(this)' />
				</div>

				<div id='tor_relay_max_bw_container' class="form-group">
					<label for='tor_relay_max_bw' id='tor_relay_max_bw_label'><%~ MaxRB %>:</label>
					<span><input type="text" class="form-control" id='tor_relay_max_bw' size='9' onkeyup='proofreadNumeric(this)' /><em>&nbsp;&nbsp;<%~ KBs %></em></span>
				</div>

				<div id='tor_relay_publish_container' class="form-group">
					<label for='tor_relay_publish' id='tor_relay_publish_label'><%~ PubBrDB %>:</label>
					<select class="form-control" id="tor_relay_publish">
						<option value="1"><%~ PubBr %></option>
						<option value="0"><%~ NoPub %></option>
					</select>
				</div>

				<div id='tor_relay_nickname_container' class="form-group">
					<label for='tor_relay_nickname' id='tor_relay_nickname_label'><%~ Nick %>:</label>
					<input type="text" class="form-control" id='tor_relay_nickname' />
				</div>

				<div id='tor_relay_contact_container' class="form-group">
					<label for='tor_relay_contact' id='tor_relay_contact_label'><%~ Mail %>:</label>
					<textarea class="form-control" id='tor_relay_contact' ></textarea>
				</div>

				<div id='tor_relay_status_link_container' class="form-group">
					<span class='nocolum'><%~ VisMsg %> <a href="http://torstatus.blutmagie.de/"><%~ GlbMsg %></a></span>
				</div>

			</div>

		</div>
	</div>

</div>

<div class="row tor_data_dir_section">

	<div class="col-lg-6 ">
		<div class="panel panel-default">

			<div class="panel-heading">
				<h3 class="panel-title"><%~ TDDir %></h3>
			</div>

			<div class="panel-body">

				<div>
					<span><%~ TDDir %>:</span>
					<span id="tor_dir_ramdisk_static">/var/tor</span>
					<span id="tor_dir_root_static">/usr/lib/tor</span>
					<input type="text" id="tor_dir_text" style="display:none" />
				</div>
				<div>
					<span><%~ TDDrv %>:</span>
					<select id="tor_dir_drive_select" onchange="setTorVisibility()"></select>
				</div>
				<div>
					<div>
						<em><%~ CacheWarn %></em>
					</div>
				</div>

			</div>

		</div>
	</div>

</div>

<div id="bottom_button_container">
	<button id="save_button" class="btn btn-primary" onclick="saveChanges()"><%~ SaveChanges %></button>
	<button id="reset_button" class="btn btn-warning" onclick="resetData()"><%~ Reset %></button>
</div>

<script>
	resetData();
</script>

<%
	gargoyle_header_footer -f -s "connection" -p "tor"
%>
