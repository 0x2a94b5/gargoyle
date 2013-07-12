﻿/*
 * UTF-8 (with BOM) Spanish-ES text strings for port_forwarding(single,multi).sh html elements
 */

prtS.PISect="Redireccionar Puerto Individual";
prtS.PRSect="Redireccionar Rango de Puertos";
prtS.ForIPort="Redireccionar Puertos individual de WAN a LAN";
prtS.ForRPort="Redireccionar Rango de Puertos de WAN a LAN";
prtS.DMZ="DMZ";
prtS.UseDMZ="Use DMZ (Zona Desmilitarizada)";
prtS.DMZIP="DMZ IP";
prtS.UP_NAT="UPnP / NAT-PMP";
prtS.UPNAT_En="Permitir UPnP &amp; NAT-PMP servicio";
prtS.APFor="Puerto delantero activo";
prtS.USpd="Velocidad de carga de informar";
prtS.DSpd="Velocidad de descarga de informar";
prtS.scnd="segundo";
prtS.UPHelp="UPnP (Universal Plug and Play) y NAT-PMP (NAT Port Mapping Protocol) son los dos protocolos que permite a los dispositivos y aplicaciones de la red LAN para configurar automáticamente el enrutador con los delanteros portuarios necesarios para su correcto funcionamiento. Si el dispositivo es compatible con cualquier protocolo que no es necesario crear reglas forward port manual (ver la parte superior de esta página), ya que se crearán automáticamente por el dispositivo.</p><p>Cuando está activada Gargoyle muestra una tabla de creada automáticamente reenvía puerto para que pueda ver qué dispositivos han solicitado adelante y comprobar que esta característica funciona correctamente. Este servicio puede no funcionar correctamente en las configuraciones de red que contienen dos o más enrutadores NAT (doble). Si usted ve una sola fila con '***' significa que no hay puerto reenvía registrados.</p><p>Como parte del protocolo del dispositivo de LAN puede solicitar la velocidad de la conexión WAN del enrutador. Dos campos se proporcionan para configurar la respuesta a tales preguntas. Las aplicaciones cliente pueden utilizar esta información para optimizar su rendimiento. Pero es importante tener en cuenta que el enrutador no hace nada para limitar las velocidades basadas en estos datos. Sólo se informa al solicitante. Si se introduce cero para cualquier valor de la velocidad de la interfaz se informa, por lo general de 100 MB o 1 GB, dependiendo de la velocidad de la interfaz del enrutador.</p><p>Existe cierta controversia sobre la seguridad de este servicio y sí se requiere RAM adicional para ejecutar lo que puede ser importante en los enrutadores limitadas de memoria, así que por defecto esta función está desactivada.";

//templates
prtS.Desc="Descripción";
prtS.optl="(opcional)";
prtS.Proto="Protocolo";
prtS.FPrt="Puerto Desde";
prtS.TIP="IP Hasta";
prtS.TPrt="Puerto Hasta";
prtS.SPrt="Puerto Inicial";
prtS.EPrt="Puerto Terminal";

//javascript
prtS.AFRErr="No se pudo agregar regla de reenvío.";
prtS.GTErr="Puerto Inicial > Puerto Terminal";
prtS.DupErr="Puerto(s) dentro rango ya está/están siendo reenviado";
prtS.CopErr="Puerto ya está siendo reenviado";
prtS.UpErr="No se pudo actualizar el puerto reenviado.";
prtS.Prot="Proto";
prtS.LHst="LAN Hospedador";
prtS.Port="Puerto";

//edit.sh pages
prtS.PESect="Editar Redireccionar Puerto";
