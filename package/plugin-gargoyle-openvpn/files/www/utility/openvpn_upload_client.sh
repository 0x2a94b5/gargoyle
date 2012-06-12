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
	
	mv "$conf_file" "$client_name.conf"
	mv "$ca_file"   "${client_name}_ca.crt"
	mv "$cert_file" "$client_name.crt"
	mv "$key_file"  "$client_name.key"

elif [ -s "$FORM_openvpn_client_conf_file" ] && [ -s "$FORM_openvpn_client_ca_file" ] && [ -s "$FORM_openvpn_client_cert_file" ] && [ -s "$FORM_openvpn_client_key_file" ] ; then 
	
	mv "$FORM_openvpn_client_conf_file" "$client_name.conf"
	mv "$FORM_openvpn_client_ca_file"   "${client_name}_ca.crt"
	mv "$FORM_openvpn_client_cert_file" "$client_name.crt"
	mv "$FORM_openvpn_client_key_file"  "$client_name.key"
	
elif [ -n "$FORM_openvpn_client_conf_text" ] && [ -n "$FORM_openvpn_client_ca_text" ] && [ -n "$FORM_openvpn_client_cert_text" ] && [ -n "$FORM_openvpn_client_key_text" ] ; then

	printf "$FORM_openvpn_client_conf_text" > "$client_name.conf"
	printf "$FORM_openvpn_client_ca_text"   > "${client_name}_ca.crt"
	printf "$FORM_openvpn_client_cert_text" > "$client_name.crt"
	printf "$FORM_openvpn_client_key_text"  > "$client_name.key"	
fi

if [ -e "$client_name.conf" ] ; then
	
	sed -i 's/ca.*$/ca    \/etc\/openvpn\/'"${client_name}_ca.crt"'/g'  "$client_name.conf"
	sed -i 's/cert.*$/cert  \/etc\/openvpn\/'"$client_name.crt"'/g'     "$client_name.conf"
	sed -i 's/key.*$/key   \/etc\/openvpn\/'"$client_name.key"'/g'      "$client_name.conf"

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
	printf "\n<p>\nSuccess\n</p>\n"
else
	#ERROR
	printf "\n<p>\nError\n</p>\n"

fi
echo "<script type=\"text/javascript\">top.clientSaved();</script>"
echo "</body></html>"

cd /tmp
rm -rf "$tmp_dir"



?>
