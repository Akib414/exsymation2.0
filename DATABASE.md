# **Exsymation \- Database Tables**

## **Teacher**

| Attribute | Type |
| :---- | :---- |
| id (mongodb) | String |
| name | String |
| email | String |
| phone | String |
| nid | String |
| photo | String |
| password | String |
| status | Enum(active/inactive) |

## **Course**

| Attribute | Type |
| :---- | :---- |
| id (mongodb) | String |
| course\_code | String |
| course\_name | String |
| course\_type | Enum (Theory / Lab) |

## **Semester Course**

| Attribute | Type |
| :---- | :---- |
| id (mongodb) | String |
| semester | Number (1-10) |
| course\_list | List of course code |

## **Department Chairman**

| Attribute | Type |
| :---- | :---- |
| id (mongodb) | String |
| teacher\_id | String |
| status | Enum (Active / Inactive) |

## **Exam Committee**

| Attribute | Type |
| :---- | :---- |
| id (mongodb) | String |
| chairman | String (teacher\_id) |
| member1 | String (teacher\_id) |
| member2 | String (teacher\_id) |
| external | Number (Phone) |
| session | String |
| semester | Number |
| start | DATE |
| end | DATE |
| status | Enum (active / inactive) |
| tabulator1 | String(teacher\_id) |
| tabulator2 | String(teacher\_id) |

## **Session**

| Attribute | Type |
| :---- | :---- |
| id (mongodb) | String |
| session | String |
| batch | String |
| current\_semester | Number (1-10) |
| status | Enum (active/inactive) |

## **Routine**

| Attribute | Type |
| :---- | :---- |
| id (mongodb) | String |
| session | String |
| semester | Number (1-10) |
| date | DATE |
| time | TIME |
| inv\_list | List of invigilators |
| course\_id (mongodb) | String |

## **Notification**

| Attribute | Type |
| :---- | :---- |
| id (mongodb) | String |
| from | String(teacher\_id) |
| to | List(teacher\_id) |

## **Course Assignment**

| Attribute | Type |
| :---- | :---- |
| id (mongodb) | String |
| session | Text |
| semester | Number |
| course\_code | String |
| first\_examiner | List(teacher\_id) |
| second\_examiner | String(teacher\_id (mongodb)) |
| third\_examiner | Pair(teacher\_id, student\_count) |

## **Admin**

| id (mongodb) | String |
| :---- | :---- |
| username | String |
| password | String |

