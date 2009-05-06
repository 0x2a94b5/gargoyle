/*  timerange --	A netfilter module to match URLs in HTTP requests 
 *  		This module can match using string match or regular expressions
 *  		Originally designed for use with Gargoyle router firmware (gargoyle-router.com)
 *
 *
 *  Copyright © 2008 by Eric Bishop <eric@gargoyle-router.com>
 * 
 *  This file is free software: you may copy, redistribute and/or modify it
 *  under the terms of the GNU General Public License as published by the
 *  Free Software Foundation, either version 2 of the License, or (at your
 *  option) any later version.
 *
 *  This file is distributed in the hope that it will be useful, but
 *  WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 *  General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */




#ifndef _IPT_TIMERANGE_H
#define _IPT_TIMERANGE_H


#define RANGE_LENGTH 51

#define HOURS 1
#define WEEKDAYS 3
#define DAYS_HOURS 4
#define WEEKLY_RANGE 10


struct ipt_timerange_info
{
	long ranges[RANGE_LENGTH];
	char days[7];
	char type;
};
#endif /*_IPT_TIMERANGE_H*/
