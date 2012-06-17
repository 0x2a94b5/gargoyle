#!/usr/bin/haserl --upload-limit=1048576 --upload-dir=/tmp/
<?

eval $( gargoyle_session_validator -c "$COOKIE_hash" -e "$COOKIE_exp" -a "$HTTP_USER_AGENT" -i "$REMOTE_ADDR" -r "login.sh" -t $(uci get gargoyle.global.session_timeout) -b "$COOKIE_browser_time"  )	



echo "Content-type: text/html"
echo ""

echo '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">'
echo '<html xmlns="http://www.w3.org/1999/xhtml">'
echo '<body>'

dir_rand=$(</dev/urandom tr -dc a-z | head -c 12)
tmp_dir="/tmp/vpn_client_upload_$dir_rand"
mkdir -p "$tmp_dir"
cd "$tmp_dir"

client_name=$(uci get openvpn_gargoyle.client.id 2>/dev/null)
if [ -z "$client_name" ] ; then
	client_name_rand=$(</dev/urandom tr -dc a-z | head -c 12)
	client_name="grouter_client_$client_name_rand"
fi

error=""

if [ -s "$FORM_openvpn_client_zip_file" ] ; then

	is_targz=$(echo "$FORM_openvpn_client_zip_file" | grep "\.tar\.gz$\|\.tgz$")
	if [ -n "$is_targz" ] ; then
		tar xzf "$FORM_openvpn_client_zip_file" >/dev/null 2>&1
	else
		unzip   "$FORM_openvpn_client_zip_file" >/dev/null 2>&1
	fi

	OLD_IFS="$IFS"
	IFS=$(printf "\n\r")
	files=$(find .)
	for f in $files ; do
		if [ ! -d "$f" ] ; then mv "$f" . ; fi
	done
	for f in $files ; do
		if [ -d "$f" ] && [ "$f" != "." ] ; then rm -rf "$f" ; fi
	done
	IFS="$OLD_IFS"


	conf_file=$(grep -l "^[\t ]*ca\|^[\t ]*cert" * 2>/dev/null | head -n 1)
	ca_file=$(  egrep "^[\t ]*ca[\t ]+"   $conf_file | sed 's/^.*\///g')
	cert_file=$(egrep "^[\t ]*cert[\t ]+" $conf_file | sed 's/^.*\///g')
	key_file=$( egrep "^[\t ]*key[\t ]+"  $conf_file | sed 's/^.*\///g')


	if   [ ! -f "$ca_file" ] ; then
		error="Could not find CA file"
	elif [ ! -f "$cert_file" ] ; then
		error="Could not find certificate file"
	elif [ ! -f "$key_file" ] ; then
		error="Could not find key File"
	elif [ ! -f "$conf_file" ] ; then
		error="Could not find config file"
	else
		mv "$conf_file" "${client_name}.conf"
		mv "$ca_file"   "${client_name}_ca.crt"
		mv "$cert_file" "${client_name}.crt"
		mv "$key_file"  "${client_name}.key"
	fi

	rm "$FORM_openvpn_client_zip_file" 

elif [ -s "$FORM_openvpn_client_conf_file" ] && [ -s "$FORM_openvpn_client_ca_file" ] && [ -s "$FORM_openvpn_client_cert_file" ] && [ -s "$FORM_openvpn_client_key_file" ] ; then 
	
	mv "$FORM_openvpn_client_conf_file" "${client_name}.conf"
	mv "$FORM_openvpn_client_ca_file"   "${client_name}_ca.crt"
	mv "$FORM_openvpn_client_cert_file" "${client_name}.crt"
	mv "$FORM_openvpn_client_key_file"  "${client_name}.key"
	
elif [ -n "$FORM_openvpn_client_conf_text" ] && [ -n "$FORM_openvpn_client_ca_text" ] && [ -n "$FORM_openvpn_client_cert_text" ] && [ -n "$FORM_openvpn_client_key_text" ] ; then

	printf "$FORM_openvpn_client_conf_text" > "${client_name}.conf"
	printf "$FORM_openvpn_client_ca_text"   > "${client_name}_ca.crt"
	printf "$FORM_openvpn_client_cert_text" > "${client_name}.crt"
	printf "$FORM_openvpn_client_key_text"  > "${client_name}.key"	

fi


if [ ! -f "${client_name}.conf" ] ; then
	error="Could not find config file"
fi

if [ -z "$error" ] ; then
	
	sed -i 's/^[\t ]*ca.*$/ca    \/etc\/openvpn\/'"${client_name}_ca.crt"'/g'    "${client_name}.conf"
	sed -i 's/^[\t ]*cert.*$/cert  \/etc\/openvpn\/'"${client_name}.crt"'/g'     "${client_name}.conf"
	sed -i 's/^[\t ]*key.*$/key   \/etc\/openvpn\/'"${client_name}.key"'/g'      "${client_name}.conf"

	#proofreading
	use_tap=$(egrep  "^[\t ]*dev[\t ]+tap" "${client_name}.conf")
	if [ -n "$use_tap" ] ; then
		error="Gargoyle does not support TAP OpenVPN configurations"
	fi

	if [ -z "$error" ] ; then
		mv * /etc/openvpn/

		#run constant uci commands
		uci set openvpn_gargoyle.server.enabled="false"                        >/dev/null 2>&1
		uci set openvpn_gargoyle.client.enabled="true"                         >/dev/null 2>&1
		uci set openvpn_gargoyle.client.id="$client_name"                      >/dev/null 2>&1
		uci set openvpn.custom_config.config="/etc/openvpn/$client_name.conf"  >/dev/null 2>&1
		uci set openvpn.custom_config.enable="1"                               >/dev/null 2>&1
		uci commit

		#run other commands passed to script (includes firewall config and openvpn restart)
		if [ -n "$FORM_commands" ] ; then	
			tmp_file="$tmp_dir/tmp.sh"
			printf "%s" "$FORM_commands" > $tmp_file
			sh $tmp_file
		fi

		wait_secs=25
		have_tun_if=$(ifconfig 2>/dev/null | grep "^tun")
		while [ -z "$have_tune_if" ] && [ "$wait_secs" -gt 0 ] ; do
			sleep 1
			have_tun_if=$(ifconfig 2>/dev/null | grep "^tun")
			wait_secs=$(( $wait_secs - 1 ))
		done
		
		if [ -z "$have_tun_if" ] ; then
			error="Parameters saved but OpenVPN failed to connect. Re-check your configuration."
		fi
	fi
fi


result="$error"
if [ -z "$error" ] ; then
	result="Success"
fi

echo "<script type=\"text/javascript\">top.clientSaved(\"$result\");</script>"
echo "</body></html>"

cd /tmp
rm -rf "$tmp_dir"



?>
