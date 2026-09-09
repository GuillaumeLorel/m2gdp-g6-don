# Modèle de données — DON (enchères caritatives)

Diagramme de classes (à éditer sur mermaidchart.com ou dans l'IDE).

```mermaid
classDiagram
    class Utilisateur {
        +string id
        +string email
        +string nom
        +string prenom
        +string photoUrl
        +string codePostal
        +string typeUtilisateur
        +date createdAt
    }

    class Annonce {
        +string id
        +string title
        +string description
        +string category
        +number startingBid
        +number currentBid
        +date endsAt
        +string status
        +string postalCode
        +string[] photos
    }

    class Offre {
        +string id
        +number amount
        +date createdAt
    }

    class Cause {
        +string id
        +string nom
        +string description
    }

    class Conversation {
        +string id
        +date createdAt
    }

    class Message {
        +string id
        +string contenu
        +date createdAt
    }

    Utilisateur "1" --> "*" Annonce : publie
    Annonce "1" --> "*" Offre : reçoit
    Utilisateur "1" --> "*" Offre : place
    Annonce "*" --> "1" Cause : reverse à
    Annonce "1" --> "1" Conversation : discute
    Conversation "1" --> "*" Message : contient
    Utilisateur "1" --> "*" Message : envoie
```

## Notes métier

- Une **Annonce** appartient à un **Utilisateur** vendeur, cible une **Cause**
  caritative, et se termine à une date (`endsAt`).
- Une **Offre** est placée par un enchérisseur ; `currentBid` de l'annonce
  reflète la meilleure offre.
- La **Conversation** lie vendeur et enchérisseur pour organiser le retrait de
  l'objet.
